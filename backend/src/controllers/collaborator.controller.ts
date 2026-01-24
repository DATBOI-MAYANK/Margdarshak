import { Request, Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';

interface Collaborator {
  id: number;
  itinerary_id: number;
  user_id: number;
  permission: 'view' | 'edit';
  status: 'pending' | 'accepted' | 'rejected';
  invited_by: number;
  invited_at: Date;
  email?: string;
  name?: string;
}

export class CollaboratorController {
  /**
   * GET /api/collaborators/:itineraryId
   * Get all collaborators for an itinerary
   */
  async getCollaborators(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { itineraryId } = req.params;
      const userId = req.user?.id;

      // Check if user has access to this itinerary
      const hasAccess = await this.checkItineraryAccess(userId!, parseInt(itineraryId));
      if (!hasAccess) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      // Get itinerary owner info
      const itineraryInfo = await pool.query(
        `SELECT i.user_id as owner_id, u.name as owner_name, u.email as owner_email 
         FROM itineraries i 
         JOIN users u ON i.user_id = u.id 
         WHERE i.id = $1`,
        [itineraryId]
      );
      
      const owner = itineraryInfo.rows[0];
      const isOwner = owner?.owner_id === userId;

      const collaboratorsRes = await pool.query(
        `SELECT 
          ic.id,
          ic.itinerary_id,
          ic.user_id,
          ic.permission,
          ic.status,
          ic.invited_by,
          ic.invited_at,
          u.email,
          u.name,
          inv.email as invited_by_email,
          inv.name as invited_by_name
        FROM itinerary_collaborators ic
        JOIN users u ON ic.user_id = u.id
        JOIN users inv ON ic.invited_by = inv.id
        WHERE ic.itinerary_id = $1
        ORDER BY ic.status = 'accepted' DESC, ic.invited_at DESC`,
        [itineraryId]
      );

      res.json({ 
        collaborators: collaboratorsRes.rows,
        owner: {
          id: owner?.owner_id,
          name: owner?.owner_name,
          email: owner?.owner_email
        },
        isOwner,
        currentUserId: userId
      });
    } catch (error) {
      console.error('Get collaborators error:', error);
      res.status(500).json({ error: 'Failed to fetch collaborators' });
    }
  }

  /**
   * POST /api/collaborators/:itineraryId/invite
   * Invite a user to collaborate on an itinerary
   */
  async inviteCollaborator(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { itineraryId } = req.params;
      const { email, permission = 'edit' } = req.body;
      const inviterId = req.user?.id;

      // Check if user is owner of the itinerary
      const isOwner = await this.checkItineraryOwner(inviterId!, parseInt(itineraryId));
      if (!isOwner) {
        res.status(403).json({ error: 'Only the owner can invite collaborators' });
        return;
      }

      // Find user by email
      const usersRes = await pool.query('SELECT id, email, name FROM users WHERE email = $1', [email]);
      const user = usersRes.rows[0];

      if (!user) {
        res.status(404).json({ error: 'User not found. They must be registered to collaborate.' });
        return;
      }

      // Can't invite yourself
      if (user.id === inviterId) {
        res.status(400).json({ error: 'You cannot invite yourself' });
        return;
      }

      // Check if already a collaborator
      const existing = await pool.query(
        'SELECT id FROM itinerary_collaborators WHERE itinerary_id = $1 AND user_id = $2',
        [itineraryId, user.id]
      );

      if (existing.rows.length > 0) {
        res.status(400).json({ error: 'User is already a collaborator' });
        return;
      }

      // Add collaborator
      await pool.query(
        'INSERT INTO itinerary_collaborators (itinerary_id, user_id, permission, invited_by) VALUES ($1, $2, $3, $4)',
        [itineraryId, user.id, permission, inviterId]
      );

      res.status(201).json({
        message: 'Collaborator invited successfully',
        collaborator: {
          user_id: user.id,
          email: user.email,
          name: user.name,
          permission
        }
      });
    } catch (error: any) {
      console.error('Invite collaborator error:', error);
      if (error.code === 'ER_DUP_ENTRY') {
        res.status(400).json({ error: 'User is already a collaborator' });
      } else {
        res.status(500).json({ error: 'Failed to invite collaborator' });
      }
    }
  }

  /**
   * PUT /api/collaborators/:itineraryId/:collaboratorId
   * Update collaborator permission
   */
  async updatePermission(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { itineraryId, collaboratorId } = req.params;
      const { permission } = req.body;
      const userId = req.user?.id;

      // Check if user is owner
      const isOwner = await this.checkItineraryOwner(userId!, parseInt(itineraryId));
      if (!isOwner) {
        res.status(403).json({ error: 'Only the owner can update permissions' });
        return;
      }

      await pool.query(
        'UPDATE itinerary_collaborators SET permission = $1 WHERE id = $2 AND itinerary_id = $3',
        [permission, collaboratorId, itineraryId]
      );

      res.json({ message: 'Permission updated successfully' });
    } catch (error) {
      console.error('Update permission error:', error);
      res.status(500).json({ error: 'Failed to update permission' });
    }
  }

  /**
   * DELETE /api/collaborators/:itineraryId/:collaboratorId
   * Remove a collaborator
   */
  async removeCollaborator(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { itineraryId, collaboratorId } = req.params;
      const userId = req.user?.id;

      // Check if user is owner OR if user is removing themselves
      const isOwner = await this.checkItineraryOwner(userId!, parseInt(itineraryId));
      
      // Get collaborator to check if it's the user themselves
      const collabsRes = await pool.query(
        'SELECT user_id FROM itinerary_collaborators WHERE id = $1',
        [collaboratorId]
      );
      const collab = collabsRes.rows[0];
      
      const isSelf = collab && collab.user_id === userId;

      if (!isOwner && !isSelf) {
        res.status(403).json({ error: 'You can only remove yourself or be the owner to remove others' });
        return;
      }

      await pool.query(
        'DELETE FROM itinerary_collaborators WHERE id = $1 AND itinerary_id = $2',
        [collaboratorId, itineraryId]
      );

      res.json({ message: 'Collaborator removed successfully' });
    } catch (error) {
      console.error('Remove collaborator error:', error);
      res.status(500).json({ error: 'Failed to remove collaborator' });
    }
  }

  /**
   * GET /api/collaborators/shared-with-me
   * Get all itineraries shared with the current user (accepted)
   */
  async getSharedWithMe(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      const itinerariesRes = await pool.query(
        `SELECT 
          i.*,
          ic.permission,
          u.email as owner_email,
          u.name as owner_name
        FROM itinerary_collaborators ic
        JOIN itineraries i ON ic.itinerary_id = i.id
        JOIN users u ON i.user_id = u.id
        WHERE ic.user_id = $1 AND ic.status = 'accepted'
        ORDER BY ic.invited_at DESC`,
        [userId]
      );

      res.json({ itineraries: itinerariesRes.rows });
    } catch (error) {
      console.error('Get shared itineraries error:', error);
      res.status(500).json({ error: 'Failed to fetch shared itineraries' });
    }
  }

  /**
   * GET /api/collaborators/pending-invites
   * Get all pending invitations for the current user
   */
  async getPendingInvites(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      const invitesRes = await pool.query(
        `SELECT 
          ic.id,
          ic.itinerary_id,
          ic.permission,
          ic.invited_at,
          i.destination as itinerary_title,
          i.destination,
          i.start_date,
          i.end_date,
          u.email as inviter_email,
          u.name as inviter_name
        FROM itinerary_collaborators ic
        JOIN itineraries i ON ic.itinerary_id = i.id
        JOIN users u ON ic.invited_by = u.id
        WHERE ic.user_id = $1 AND ic.status = 'pending'
        ORDER BY ic.invited_at DESC`,
        [userId]
      );

      res.json({ invites: invitesRes.rows });
    } catch (error) {
      console.error('Get pending invites error:', error);
      res.status(500).json({ error: 'Failed to fetch pending invites' });
    }
  }

  /**
   * PUT /api/collaborators/invites/:inviteId/accept
   * Accept a collaboration invite
   */
  async acceptInvite(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { inviteId } = req.params;
      const userId = req.user?.id;

      // Verify this invite belongs to the user
      const invitesRes = await pool.query(
        'SELECT id FROM itinerary_collaborators WHERE id = $1 AND user_id = $2 AND status = $3',
        [inviteId, userId, 'pending']
      );

      if (invitesRes.rows.length === 0) {
        res.status(404).json({ error: 'Invite not found or already processed' });
        return;
      }

      await pool.query(
        'UPDATE itinerary_collaborators SET status = $1 WHERE id = $2',
        ['accepted', inviteId]
      );

      res.json({ message: 'Invite accepted successfully' });
    } catch (error) {
      console.error('Accept invite error:', error);
      res.status(500).json({ error: 'Failed to accept invite' });
    }
  }

  /**
   * PUT /api/collaborators/invites/:inviteId/reject
   * Reject a collaboration invite
   */
  async rejectInvite(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { inviteId } = req.params;
      const userId = req.user?.id;

      // Verify this invite belongs to the user
      const invitesRes = await pool.query(
        'SELECT id FROM itinerary_collaborators WHERE id = $1 AND user_id = $2 AND status = $3',
        [inviteId, userId, 'pending']
      );

      if (invitesRes.rows.length === 0) {
        res.status(404).json({ error: 'Invite not found or already processed' });
        return;
      }

      // Delete the invite instead of keeping rejected ones
      await pool.query(
        'DELETE FROM itinerary_collaborators WHERE id = $1',
        [inviteId]
      );

      res.json({ message: 'Invite rejected successfully' });
    } catch (error) {
      console.error('Reject invite error:', error);
      res.status(500).json({ error: 'Failed to reject invite' });
    }
  }

  // Helper methods
  private async checkItineraryAccess(userId: number, itineraryId: number): Promise<boolean> {
    // Check owner
    const ownerRes = await pool.query(
      'SELECT id FROM itineraries WHERE id = $1 AND user_id = $2',
      [itineraryId, userId]
    );
    if (ownerRes.rows.length > 0) return true;

    // Check collaborator
    const collabRes = await pool.query(
      'SELECT id FROM itinerary_collaborators WHERE itinerary_id = $1 AND user_id = $2',
      [itineraryId, userId]
    );
    return collabRes.rows.length > 0;
  }

  private async checkItineraryOwner(userId: number, itineraryId: number): Promise<boolean> {
    const result = await pool.query(
      'SELECT id FROM itineraries WHERE id = $1 AND user_id = $2',
      [itineraryId, userId]
    );
    return result.rows.length > 0;
  }

  /**
   * GET /api/collaborators/admin/all
   * Admin: Get all collaborations across all itineraries
   */
  async getAllCollaborations(req: AuthRequest, res: Response): Promise<void> {
    try {
      console.log('getAllCollaborations called by user:', req.user?.id);
      
      const collaborationsRes = await pool.query(
        `SELECT 
          ic.id,
          ic.itinerary_id,
          ic.user_id,
          ic.permission,
          ic.status,
          ic.invited_by,
          ic.invited_at,
          i.destination,
          i.destination as itinerary_title,
          i.start_date,
          i.end_date,
          u.name as collaborator_name,
          u.email as collaborator_email,
          inv.name as inviter_name,
          inv.email as inviter_email,
          owner.name as owner_name,
          owner.email as owner_email
        FROM itinerary_collaborators ic
        JOIN itineraries i ON ic.itinerary_id = i.id
        JOIN users u ON ic.user_id = u.id
        JOIN users inv ON ic.invited_by = inv.id
        JOIN users owner ON i.user_id = owner.id
        ORDER BY ic.invited_at DESC`
      );

      // Get collaboration statistics
      const statsRes = await pool.query(
        `SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted,
          SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
          SUM(CASE WHEN permission = 'edit' THEN 1 ELSE 0 END) as edit_access,
          SUM(CASE WHEN permission = 'view' THEN 1 ELSE 0 END) as view_access
        FROM itinerary_collaborators`
      );

      // Get most collaborative users
      const topCollaboratorsRes = await pool.query(
        `SELECT 
          u.id,
          u.name,
          u.email,
          COUNT(ic.id) as collaboration_count
        FROM users u
        JOIN itinerary_collaborators ic ON u.id = ic.user_id
        WHERE ic.status = 'accepted'
        GROUP BY u.id, u.name, u.email
        ORDER BY collaboration_count DESC
        LIMIT 5`
      );

      // Get most shared itineraries
      const mostSharedRes = await pool.query(
        `SELECT 
          i.id,
          i.destination,
          i.destination as title,
          u.name as owner_name,
          COUNT(ic.id) as share_count
        FROM itineraries i
        JOIN users u ON i.user_id = u.id
        JOIN itinerary_collaborators ic ON i.id = ic.itinerary_id
        GROUP BY i.id, i.destination, u.name
        ORDER BY share_count DESC
        LIMIT 5`
      );

      res.json({
        collaborations: collaborationsRes.rows,
        stats: statsRes.rows[0],
        topCollaborators: topCollaboratorsRes.rows,
        mostShared: mostSharedRes.rows
      });
      console.log('Collaborations response sent:', { 
        collaborationsCount: collaborationsRes.rows.length,
        stats: statsRes.rows[0]
      });
    } catch (error) {
      console.error('Get all collaborations error:', error);
      res.status(500).json({ error: 'Failed to fetch collaborations' });
    }
  }
}

export const collaboratorController = new CollaboratorController();
