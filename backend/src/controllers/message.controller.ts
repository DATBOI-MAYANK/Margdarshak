import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { socketService } from '../services/socket.service';

export class MessageController {
  // ADMIN: Send broadcast notice to all travelers
  async sendBroadcast(req: AuthRequest, res: Response): Promise<void> {
    try {
      const adminId = req.user?.id;
      const { subject, content, priority = 'normal' } = req.body;

      if (!subject || !content) {
        res.status(400).json({ error: 'Subject and content are required' });
        return;
      }

      const result = await pool.query(
        `INSERT INTO messages (sender_id, receiver_id, message_type, subject, content, priority)
         VALUES ($1, NULL, 'broadcast', $2, $3, $4) RETURNING id`,
        [adminId, subject, content, priority]
      );

      const messageId = result.rows[0].id;

      const travelers = await pool.query(
        `SELECT id FROM users WHERE role = 'Traveler'`
      );

      for (const traveler of travelers.rows) {
        await pool.query(
          `INSERT INTO notifications (user_id, type, title, content, reference_id)
           VALUES ($1, 'broadcast', $2, $3, $4)`,
          [traveler.id, subject, content.substring(0, 200), messageId]
        );

        socketService.sendToUser(traveler.id, 'notification', {
          type: 'broadcast',
          title: subject,
          content: content.substring(0, 100) + '...',
          priority,
          messageId
        });
      }

      res.status(201).json({
        message: 'Broadcast sent successfully',
        messageId,
        recipientCount: travelers.rows.length
      });
    } catch (error) {
      console.error('Send broadcast error:', error);
      res.status(500).json({ error: 'Failed to send broadcast' });
    }
  }

  // ADMIN: Send message to specific user
  async sendToUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      const adminId = req.user?.id;
      const { userId } = req.params;
      const { subject, content, priority = 'normal' } = req.body;

      if (!subject || !content) {
        res.status(400).json({ error: 'Subject and content are required' });
        return;
      }

      const result = await pool.query(
        `INSERT INTO messages (sender_id, receiver_id, message_type, subject, content, priority)
         VALUES ($1, $2, 'direct', $3, $4, $5) RETURNING id`,
        [adminId, userId, subject, content, priority]
      );

      const messageId = result.rows[0].id;

      await pool.query(
        `INSERT INTO notifications (user_id, type, title, content, reference_id)
         VALUES ($1, 'message', $2, $3, $4)`,
        [userId, subject, content.substring(0, 200), messageId]
      );

      socketService.sendToUser(parseInt(userId), 'notification', {
        type: 'message',
        title: subject,
        content: content.substring(0, 100) + '...',
        priority,
        messageId
      });

      res.status(201).json({
        message: 'Message sent successfully',
        messageId
      });
    } catch (error) {
      console.error('Send to user error:', error);
      res.status(500).json({ error: 'Failed to send message' });
    }
  }

  // TRAVELER: Send support query (Contact Us)
  async sendSupportMessage(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const userName = req.user?.name;
      const { subject, content, priority = 'normal' } = req.body;

      if (!subject || !content) {
        res.status(400).json({ error: 'Subject and content are required' });
        return;
      }

      const result = await pool.query(
        `INSERT INTO messages (sender_id, receiver_id, message_type, subject, content, priority)
         VALUES ($1, NULL, 'support', $2, $3, $4) RETURNING id`,
        [userId, subject, content, priority]
      );

      const messageId = result.rows[0].id;

      await pool.query(
        `INSERT INTO notifications (user_id, type, title, content, reference_id)
         VALUES ($1, 'system', $2, $3, $4)`,
        [userId, 'Support Request Received', 'Your support request has been received. We will respond within 24 hours.', messageId]
      );

      const admins = await pool.query(
        `SELECT id FROM users WHERE role = 'Admin'`
      );

      for (const admin of admins.rows) {
        await pool.query(
          `INSERT INTO notifications (user_id, type, title, content, reference_id)
           VALUES ($1, 'message', $2, $3, $4)`,
          [admin.id, 'New Support Request from ' + userName, subject, messageId]
        );

        socketService.sendToUser(admin.id, 'notification', {
          type: 'support',
          title: 'New Support Request',
          content: userName + ': ' + subject,
          priority,
          messageId
        });
      }

      res.status(201).json({
        message: 'Support request submitted successfully',
        messageId
      });
    } catch (error) {
      console.error('Send support message error:', error);
      res.status(500).json({ error: 'Failed to send support message' });
    }
  }

  // ADMIN: Reply to support ticket
  async replySupportMessage(req: AuthRequest, res: Response): Promise<void> {
    try {
      const adminId = req.user?.id;
      const adminName = req.user?.name;
      const { messageId } = req.params;
      const { content, resolve = false } = req.body;

      if (!content) {
        res.status(400).json({ error: 'Reply content is required' });
        return;
      }

      const messages = await pool.query(
        `SELECT * FROM messages WHERE id = $1`,
        [messageId]
      );

      if (messages.rows.length === 0) {
        res.status(404).json({ error: 'Message not found' });
        return;
      }

      const originalMessage = messages.rows[0];

      const result = await pool.query(
        `INSERT INTO messages (sender_id, receiver_id, message_type, subject, content, parent_id)
         VALUES ($1, $2, 'system', $3, $4, $5) RETURNING id`,
        [adminId, originalMessage.sender_id, 'Re: ' + originalMessage.subject, content, messageId]
      );

      const newStatus = resolve ? 'resolved' : 'read';
      await pool.query(
        `UPDATE messages SET status = $1 WHERE id = $2`,
        [newStatus, messageId]
      );

      await pool.query(
        `INSERT INTO notifications (user_id, type, title, content, reference_id)
         VALUES ($1, 'support_reply', $2, $3, $4)`,
        [originalMessage.sender_id, 'Support Reply from ' + adminName, content.substring(0, 200), result.rows[0].id]
      );

      socketService.sendToUser(originalMessage.sender_id, 'notification', {
        type: 'support_reply',
        title: 'Support Reply',
        content: 'Your support ticket has received a response.',
        messageId: result.rows[0].id
      });

      res.json({
        message: 'Reply sent successfully',
        replyId: result.rows[0].id,
        status: newStatus
      });
    } catch (error) {
      console.error('Reply support message error:', error);
      res.status(500).json({ error: 'Failed to send reply' });
    }
  }

  // Get user's messages
  async getMessages(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;
      const { page = '1', limit = '20', type } = req.query;
      
      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
      const params: any[] = [];

      let query: string;
      let countQuery: string;

      if (userRole === 'Admin') {
        query = `
          SELECT m.*, u.name as sender_name, u.email as sender_email
          FROM messages m
          LEFT JOIN users u ON m.sender_id = u.id
          WHERE m.message_type IN ('support', 'broadcast', 'direct')
          ORDER BY m.created_at DESC
          LIMIT $1 OFFSET $2
        `;
        countQuery = `SELECT COUNT(*) as total FROM messages WHERE message_type IN ('support', 'broadcast', 'direct')`;
      } else {
        query = `
          SELECT m.*, u.name as sender_name, u.email as sender_email
          FROM messages m
          LEFT JOIN users u ON m.sender_id = u.id
          WHERE (m.receiver_id = $1 OR m.message_type = 'broadcast' OR m.sender_id = $2)
          ORDER BY m.created_at DESC
          LIMIT $3 OFFSET $4
        `;
        countQuery = `SELECT COUNT(*) as total FROM messages WHERE (receiver_id = $1 OR message_type = 'broadcast' OR sender_id = $2)`;
        params.push(userId, userId);
      }

      const queryParams = userRole === 'Admin' 
        ? [parseInt(limit as string), offset]
        : [userId, userId, parseInt(limit as string), offset];

      const messages = await pool.query(query, queryParams);
      const countResult = await pool.query(countQuery, params);
      
      const total = countResult.rows[0].total;

      res.json({
        messages: messages.rows,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          pages: Math.ceil(total / parseInt(limit as string))
        }
      });
    } catch (error) {
      console.error('Get messages error:', error);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  }

  // Get user's notifications
  async getNotifications(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { unreadOnly = 'false' } = req.query;

      let query = `SELECT * FROM notifications WHERE user_id = $1`;
      if (unreadOnly === 'true') {
        query += ' AND is_read = FALSE';
      }
      query += ' ORDER BY created_at DESC LIMIT 50';

      const notifications = await pool.query(query, [userId]);

      const countResult = await pool.query(
        `SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = FALSE`,
        [userId]
      );

      res.json({
        notifications: notifications.rows,
        unreadCount: countResult.rows[0].count
      });
    } catch (error) {
      console.error('Get notifications error:', error);
      res.status(500).json({ error: 'Failed to fetch notifications' });
    }
  }

  // Mark message as read
  async markMessageRead(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { messageId } = req.params;
      const userId = req.user?.id;

      await pool.query(
        `UPDATE messages SET status = 'read' WHERE id = $1 AND (receiver_id = $2 OR message_type = 'broadcast')`,
        [messageId, userId]
      );

      res.json({ message: 'Message marked as read' });
    } catch (error) {
      console.error('Mark message read error:', error);
      res.status(500).json({ error: 'Failed to mark message as read' });
    }
  }

  // Mark notification as read
  async markNotificationRead(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { notificationId } = req.params;
      const userId = req.user?.id;

      await pool.query(
        `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2`,
        [notificationId, userId]
      );

      res.json({ message: 'Notification marked as read' });
    } catch (error) {
      console.error('Mark notification read error:', error);
      res.status(500).json({ error: 'Failed to mark notification as read' });
    }
  }

  // Mark all notifications as read
  async markAllNotificationsRead(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      await pool.query(
        `UPDATE notifications SET is_read = TRUE WHERE user_id = $1`,
        [userId]
      );

      res.json({ message: 'All notifications marked as read' });
    } catch (error) {
      console.error('Mark all notifications read error:', error);
      res.status(500).json({ error: 'Failed to mark all notifications as read' });
    }
  }

  // Get support tickets (Admin)
  async getSupportTickets(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { status = 'all' } = req.query;

      let statusFilter = '';
      if (status === 'pending') {
        statusFilter = "AND m.status = 'pending'";
      } else if (status === 'read') {
        statusFilter = "AND m.status IN ('read', 'resolved')";
      }

      const query = `
        SELECT m.*, u.name as sender_name, u.email as sender_email,
          (SELECT COUNT(*) FROM messages WHERE parent_id = m.id) as reply_count
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.message_type = 'support' ${statusFilter}
        ORDER BY CASE m.status WHEN 'pending' THEN 0 ELSE 1 END, m.created_at DESC
      `;

      const ticketsRes = await pool.query(query);

      const statsRes = await pool.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status IN ('read', 'resolved', 'closed') THEN 1 ELSE 0 END) as resolved
        FROM messages WHERE message_type = 'support'
      `);

      res.json({
        tickets: ticketsRes.rows,
        stats: statsRes.rows[0]
      });
    } catch (error) {
      console.error('Get support tickets error:', error);
      res.status(500).json({ error: 'Failed to fetch support tickets' });
    }
  }

  // Get message thread
  async getMessageThread(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { messageId } = req.params;

      const messagesRes = await pool.query(`
        SELECT m.*, u.name as sender_name, u.email as sender_email, u.role as sender_role
        FROM messages m
        LEFT JOIN users u ON m.sender_id = u.id
        WHERE m.id = $1 OR m.parent_id = $2
        ORDER BY m.created_at ASC
      `, [messageId, messageId]);

      if (messagesRes.rows.length === 0) {
        res.status(404).json({ error: 'Message not found' });
        return;
      }

      res.json({ messages: messagesRes.rows });
    } catch (error) {
      console.error('Get message thread error:', error);
      res.status(500).json({ error: 'Failed to fetch message thread' });
    }
  }

  // Get unread counts
  async getUnreadCounts(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;

      const notifResult = await pool.query(
        `SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = FALSE`,
        [userId]
      );
      const notificationCount = notifResult.rows[0].count;

      let messageCount = 0;
      if (userRole === 'Admin') {
        const msgResult = await pool.query(
          `SELECT COUNT(*) as count FROM messages WHERE message_type = 'support' AND status = 'pending'`
        );
        messageCount = msgResult.rows[0].count;
      } else {
        const msgResult = await pool.query(
          `SELECT COUNT(*) as count FROM messages WHERE (receiver_id = $1 OR message_type = 'broadcast') AND status = 'pending'`,
          [userId]
        );
        messageCount = msgResult.rows[0].count;
      }

      res.json({
        messages: messageCount,
        notifications: notificationCount,
        total: messageCount + notificationCount
      });
    } catch (error) {
      console.error('Get unread counts error:', error);
      res.status(500).json({ error: 'Failed to fetch unread counts' });
    }
  }

  // Delete notification
  async deleteNotification(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { notificationId } = req.params;
      const userId = req.user?.id;

      await pool.query(
        `DELETE FROM notifications WHERE id = $1 AND user_id = $2`,
        [notificationId, userId]
      );

      res.json({ message: 'Notification deleted' });
    } catch (error) {
      console.error('Delete notification error:', error);
      res.status(500).json({ error: 'Failed to delete notification' });
    }
  }
}

export const messageController = new MessageController();
