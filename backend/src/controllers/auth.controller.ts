import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { validationResult } from 'express-validator';
import pool from '../config/database';
import { User, UserResponse } from '../models/user.model';
import { AppError } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';

export class AuthController {
  async register(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      // Support tolerant parsing: if express.json didn't populate body, try rawBody
      let body: any = req.body;
      if ((!body || Object.keys(body).length === 0) && (req as any).rawBody) {
        try {
          body = JSON.parse((req as any).rawBody);
        } catch (e) {
          // leave body as-is; validation below will catch missing fields
        }
      }

      const { name, email, password, contact_info } = body || {};
      // Always set role to Traveler for new registrations - only admins can promote users
      const role = 'Traveler';

      if (!name || !email || !password) {
        res.status(400).json({ error: 'name, email and password are required' });
        return;
      }

      // Check if user already exists
      const result = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      const existingUsers = result.rows;

      if (existingUsers.length > 0) {
        res.status(400).json({ error: 'Email already registered' });
        return;
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Insert user. Some deployed DBs may have a different schema (missing optional columns),
      // so try the full INSERT first and fall back to a minimal INSERT on failure.
      let userId: number;
      try {
        const insertResult = await pool.query(
          'INSERT INTO users (name, email, password, role, contact_info) VALUES ($1, $2, $3, $4, $5) RETURNING id',
          [name, email, hashedPassword, role, contact_info]
        );
        userId = insertResult.rows[0].id;
      } catch (insertErr) {
        console.warn('User insert failed with full columns, retrying minimal insert:', insertErr);
        try {
          const insertResult2 = await pool.query(
            'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id',
            [name, email, hashedPassword]
          );
          userId = insertResult2.rows[0].id;
        } catch (insertErr2) {
          console.error('Minimal user insert also failed:', insertErr2);
          throw insertErr2; // let outer catch handle the response
        }
      }

      // Generate token
      const token = jwt.sign(
        { id: userId, name, email, role },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '7d' }
      );

      res.status(201).json({
        message: 'User registered successfully',
        token,
        user: {
          id: userId,
          name,
          email,
          role: role || 'Traveler',
          contact_info
        }
      });
    } catch (error) {
      console.error('Register error:', error, 'rawBody=', (req as any).rawBody);
      res.status(500).json({ error: 'Registration failed' });
    }
  }

  async login(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      // tolerant parsing similar to register
      let body: any = req.body;
      if ((!body || Object.keys(body).length === 0) && (req as any).rawBody) {
        try {
          body = JSON.parse((req as any).rawBody);
        } catch (e) {
          // continue; validation will handle missing fields
        }
      }

      const { email, password } = body || {};

      if (!email || !password) {
        res.status(400).json({ error: 'email and password are required' });
        return;
      }

      // Find user
      const result = await pool.query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );

      const users = result.rows;

      if (users.length === 0) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      const user = users[0] as User;

      // Check if user is suspended
      if ((user as any).status === 'suspended') {
        res.status(403).json({ error: 'Your account has been suspended. Please contact support.' });
        return;
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      // Generate token with consistent user.id field
      const token = jwt.sign(
        { id: user.id, name: user.name, email: user.email, role: user.role },
        process.env.JWT_SECRET || 'secret'
      );

      res.json({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          contact_info: user.contact_info,
          profile_picture: (user as any).profile_picture
        }
      });
    } catch (error) {
      console.error('Login error:', error, 'rawBody=', (req as any).rawBody);
      res.status(500).json({ error: 'Login failed' });
    }
  }

  async getProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const result = await pool.query(
        'SELECT id, name, email, role, contact_info, profile_picture, created_at FROM users WHERE id = $1',
        [req.user.id]
      );

      const users = result.rows;

      if (users.length === 0) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json({ user: users[0] });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({ error: 'Failed to fetch profile' });
    }
  }

  async updateProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { name, email, contact_info } = req.body;

      // Check if email is being changed and if it's already taken
      if (email) {
        const result = await pool.query(
          'SELECT id FROM users WHERE email = $1 AND id != $2',
          [email, req.user.id]
        );

        const existingUsers = result.rows;

        if (existingUsers.length > 0) {
          res.status(400).json({ error: 'Email already in use by another account' });
          return;
        }
      }

      const updateResult = await pool.query(
        'UPDATE users SET name = $1, email = $2, contact_info = $3 WHERE id = $4',
        [name, email, contact_info || null, req.user.id]
      );

      if (updateResult.rowCount === 0) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json({ message: 'Profile updated successfully' });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  }

  async uploadProfilePicture(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      // Convert the file buffer to a base64 data URL so it persists in the DB
      // This avoids filesystem storage which gets wiped on redeploy
      const base64 = req.file.buffer.toString('base64');
      const dataUrl = `data:${req.file.mimetype};base64,${base64}`;

      // Update user's profile picture in database
      await pool.query(
        'UPDATE users SET profile_picture = $1 WHERE id = $2',
        [dataUrl, req.user.id]
      );

      res.json({ 
        message: 'Profile picture uploaded successfully',
        profile_picture: dataUrl
      });
    } catch (error) {
      console.error('Upload profile picture error:', error);
      res.status(500).json({ error: 'Failed to upload profile picture' });
    }
  }

  async removeProfilePicture(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      // Set profile picture to null in database
      await pool.query(
        'UPDATE users SET profile_picture = NULL WHERE id = $1',
        [req.user.id]
      );

      res.json({ message: 'Profile picture removed successfully' });
    } catch (error) {
      console.error('Remove profile picture error:', error);
      res.status(500).json({ error: 'Failed to remove profile picture' });
    }
  }

  async changePassword(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        res.status(400).json({ error: 'Current password and new password are required' });
        return;
      }

      if (newPassword.length < 6) {
        res.status(400).json({ error: 'New password must be at least 6 characters' });
        return;
      }

      // Get current user with password
      const result = await pool.query(
        'SELECT password FROM users WHERE id = $1',
        [req.user.id]
      );

      const users = result.rows;

      if (users.length === 0) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const user = users[0] as User;

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidPassword) {
        res.status(400).json({ error: 'Current password is incorrect' });
        return;
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password
      await pool.query(
        'UPDATE users SET password = $1 WHERE id = $2',
        [hashedPassword, req.user.id]
      );

      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ error: 'Failed to change password' });
    }
  }

  async getAllUsers(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await pool.query(
        'SELECT id, name, email, role, status, contact_info, created_at FROM users ORDER BY created_at DESC'
      );

      res.json({ users: result.rows });
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  }

  // Admin: Update user role
  async updateUserRole(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { role } = req.body;

      if (!['Traveler', 'Admin'].includes(role)) {
        res.status(400).json({ error: 'Invalid role. Must be Traveler or Admin' });
        return;
      }

      // Prevent admin from changing their own role
      if (req.user && req.user.id === parseInt(userId)) {
        res.status(400).json({ error: 'Cannot change your own role' });
        return;
      }

      const updateResult = await pool.query(
        'UPDATE users SET role = $1 WHERE id = $2',
        [role, userId]
      );

      if (updateResult.rowCount === 0) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json({ message: `User role updated to ${role}` });
    } catch (error) {
      console.error('Update user role error:', error);
      res.status(500).json({ error: 'Failed to update user role' });
    }
  }

  // Admin: Update user status (suspend/activate)
  async updateUserStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { status } = req.body;

      if (!['active', 'suspended'].includes(status)) {
        res.status(400).json({ error: 'Invalid status. Must be active or suspended' });
        return;
      }

      // Prevent admin from suspending themselves
      if (req.user && req.user.id === parseInt(userId)) {
        res.status(400).json({ error: 'Cannot change your own status' });
        return;
      }

      const updateResult = await pool.query(
        'UPDATE users SET status = $1 WHERE id = $2',
        [status, userId]
      );

      if (updateResult.rowCount === 0) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json({ message: `User ${status === 'suspended' ? 'suspended' : 'activated'} successfully` });
    } catch (error) {
      console.error('Update user status error:', error);
      res.status(500).json({ error: 'Failed to update user status' });
    }
  }

  // Admin: Delete user
  async deleteUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      // Prevent admin from deleting themselves
      if (req.user && req.user.id === parseInt(userId)) {
        res.status(400).json({ error: 'Cannot delete your own account' });
        return;
      }

      // Check if user exists
      const result = await pool.query('SELECT id, role FROM users WHERE id = $1', [userId]);
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      // Delete user's collaborations first
      await pool.query('DELETE FROM itinerary_collaborators WHERE user_id = $1 OR invited_by = $2', [userId, userId]);

      // Delete user's itineraries
      await pool.query('DELETE FROM itineraries WHERE user_id = $1', [userId]);

      // Delete user
      await pool.query('DELETE FROM users WHERE id = $1', [userId]);

      res.json({ message: 'User and all associated data deleted successfully' });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  }

  // Admin: Get user statistics
  async getUserStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const totalUsersResult = await pool.query('SELECT COUNT(*) as count FROM users');
      const activeUsersResult = await pool.query("SELECT COUNT(*) as count FROM users WHERE status = 'active'");
      const suspendedUsersResult = await pool.query("SELECT COUNT(*) as count FROM users WHERE status = 'suspended'");
      const adminCountResult = await pool.query("SELECT COUNT(*) as count FROM users WHERE role = 'Admin'");
      const travelerCountResult = await pool.query("SELECT COUNT(*) as count FROM users WHERE role = 'Traveler'");

      // Recent registrations (last 7 days)
      const recentUsersResult = await pool.query(
        "SELECT COUNT(*) as count FROM users WHERE created_at >= NOW() - INTERVAL '7 days'"
      );

      res.json({
        stats: {
          total: totalUsersResult.rows[0].count,
          active: activeUsersResult.rows[0].count,
          suspended: suspendedUsersResult.rows[0].count,
          admins: adminCountResult.rows[0].count,
          travelers: travelerCountResult.rows[0].count,
          recentRegistrations: recentUsersResult.rows[0].count
        }
      });
    } catch (error) {
      console.error('Get user stats error:', error);
      res.status(500).json({ error: 'Failed to fetch user statistics' });
    }
  }
}
