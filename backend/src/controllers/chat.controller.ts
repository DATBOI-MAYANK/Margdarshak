import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { socketService } from '../services/socket.service';

interface ChatMessage {
  id: number;
  itinerary_id: number;
  user_id: number;
  message: string;
  created_at: Date;
  user_name?: string;
  user_profile_picture?: string;
}

export class CollaborationChatController {
  // =============================================
  // Get chat messages for an itinerary
  // =============================================
  async getChatMessages(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { itineraryId } = req.params;
      const userId = req.user?.id;
      const { limit = 50, before } = req.query;

      // Verify user has access to this itinerary
      const hasAccess = await this.checkAccess(userId!, parseInt(itineraryId));
      if (!hasAccess) {
        res.status(403).json({ error: 'Access denied to this itinerary' });
        return;
      }

      // Build SQL and params for PostgreSQL
      let baseQuery = `
        SELECT cc.*, u.name as user_name, u.email as user_email, u.profile_picture as user_profile_picture
        FROM collaboration_chats cc
        JOIN users u ON cc.user_id = u.id
        WHERE cc.itinerary_id = $1
      `;

      const params: any[] = [itineraryId];
      if (before) {
        baseQuery += ` AND cc.id < $2`;
        params.push(before);
      }
      // limit is always last param
      params.push(Number(limit));
      const limitIndex = params.length;
      baseQuery += ` ORDER BY cc.created_at DESC LIMIT $${limitIndex}`;

      const messagesRes = await pool.query(baseQuery, params);
      const messages = messagesRes.rows;
      messages.reverse();

      // Get participant info
      const participantsRes = await pool.query(`
        SELECT DISTINCT u.id, u.name, u.email, u.profile_picture
        FROM (
          SELECT user_id FROM itineraries WHERE id = $1
          UNION
          SELECT user_id FROM itinerary_collaborators WHERE itinerary_id = $1 AND status = 'accepted'
        ) p
        JOIN users u ON p.user_id = u.id
      `, [itineraryId]);

      res.json({
        messages,
        participants: participantsRes.rows,
        hasMore: messages.length === Number(limit)
      });
    } catch (error) {
      console.error('Get chat messages error:', error);
      res.status(500).json({ error: 'Failed to fetch chat messages' });
    }
  }

  // =============================================
  // Send chat message
  // =============================================
  async sendChatMessage(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { itineraryId } = req.params;
      const userId = req.user?.id;
      const { message } = req.body;

      if (!message || message.trim().length === 0) {
        res.status(400).json({ error: 'Message cannot be empty' });
        return;
      }

      // Verify user has access
      const hasAccess = await this.checkAccess(userId!, parseInt(itineraryId));
      if (!hasAccess) {
        res.status(403).json({ error: 'Access denied to this itinerary' });
        return;
      }

      // Get user info
      const usersRes = await pool.query(
        `SELECT name, email, profile_picture FROM users WHERE id = $1`,
        [userId]
      );
      const user = usersRes.rows[0] || { name: 'User', email: '' };

      // Insert message (return id and created_at)
      const result = await pool.query(
        `INSERT INTO collaboration_chats (itinerary_id, user_id, message)
         VALUES ($1, $2, $3) RETURNING id, created_at`,
        [itineraryId, userId, message.trim()]
      );

      const inserted = result.rows[0];
      const chatMessage = {
        id: inserted.id,
        itinerary_id: parseInt(itineraryId),
        user_id: userId,
        message: message.trim(),
        created_at: inserted.created_at || new Date(),
        user_name: user.name,
        user_email: user.email,
        user_profile_picture: user.profile_picture || null
      };

      // Broadcast to all collaborators via Socket.io
      try {
        socketService.broadcastToItinerary(parseInt(itineraryId), 'chat_message', chatMessage);
      } catch (err) {
        console.warn('Socket broadcast failed (non-fatal):', err);
      }

      // Send notifications to other collaborators (best-effort)
      try {
        const collaboratorsRes = await pool.query(`
          SELECT user_id FROM itinerary_collaborators 
          WHERE itinerary_id = $1 AND status = 'accepted' AND user_id != $2
          UNION
          SELECT user_id FROM itineraries WHERE id = $1 AND user_id != $2
        `, [itineraryId, userId]);

        const itinerariesRes = await pool.query(
          `SELECT destination FROM itineraries WHERE id = $1`,
          [itineraryId]
        );
        const itinerary = itinerariesRes.rows[0];
        const destination = itinerary?.destination || 'your itinerary';

        for (const collab of collaboratorsRes.rows) {
          try {
            await pool.query(
              `INSERT INTO notifications (user_id, type, title, content, link)
               VALUES ($1, 'collaboration', $2, $3, $4)`,
              [
                collab.user_id,
                `New message in ${destination}`,
                `${user.name}: ${message.substring(0, 100)}`,
                `/itinerary/${itineraryId}/chat`
              ]
            );
          } catch (err) {
            console.warn('Notification insert failed (non-fatal):', err);
          }

          try {
            socketService.sendToUser(collab.user_id, 'notification', {
              type: 'chat',
              title: `New message in ${destination}`,
              content: `${user.name}: ${message.substring(0, 50)}...`,
              itineraryId: parseInt(itineraryId)
            });
          } catch (err) {
            console.warn('Socket notification failed (non-fatal):', err);
          }
        }
      } catch (err) {
        console.warn('Failed to build/send notifications (non-fatal):', err);
      }

      res.status(201).json({
        message: 'Message sent successfully',
        chatMessage
      });
    } catch (error) {
      console.error('Send chat message error:', error);
      res.status(500).json({ error: 'Failed to send message' });
    }
  }

  // =============================================
  // Delete chat message (own messages only)
  // =============================================
  async deleteChatMessage(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { messageId } = req.params;
      const userId = req.user?.id;

      // Verify ownership
      const messagesRes = await pool.query(
        `SELECT * FROM collaboration_chats WHERE id = $1 AND user_id = $2`,
        [messageId, userId]
      );

      if (messagesRes.rows.length === 0) {
        res.status(403).json({ error: 'Cannot delete this message' });
        return;
      }

      const chatMessage = messagesRes.rows[0];

      await pool.query(
        `DELETE FROM collaboration_chats WHERE id = $1`,
        [messageId]
      );

      // Broadcast deletion
      socketService.broadcastToItinerary(chatMessage.itinerary_id, 'chat_message_deleted', {
        messageId: parseInt(messageId),
        itineraryId: chatMessage.itinerary_id
      });

      res.json({ message: 'Message deleted' });
    } catch (error) {
      console.error('Delete chat message error:', error);
      res.status(500).json({ error: 'Failed to delete message' });
    }
  }

  // =============================================
  // Get unread chat count for all itineraries
  // =============================================
  async getUnreadChatCounts(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      // Get itineraries where user is owner or collaborator
      const countsRes = await pool.query(`
        SELECT 
          i.id as itinerary_id,
          i.destination,
          COUNT(cc.id) as unread_count
        FROM itineraries i
        LEFT JOIN collaboration_chats cc ON cc.itinerary_id = i.id 
          AND cc.user_id != $2 
          AND cc.created_at > COALESCE(
            (SELECT MAX(created_at) FROM collaboration_chats WHERE itinerary_id = i.id AND user_id = $3),
            '1970-01-01'
          )
        WHERE i.user_id = $4 OR i.id IN (
          SELECT itinerary_id FROM itinerary_collaborators WHERE user_id = $5 AND status = 'accepted'
        )
        GROUP BY i.id, i.destination
        HAVING unread_count > 0
      `, [userId, userId, userId, userId]);
      res.json({ unreadChats: countsRes.rows });
    } catch (error) {
      console.error('Get unread chat counts error:', error);
      res.status(500).json({ error: 'Failed to fetch unread counts' });
    }
  }

  // =============================================
  // Helper: Check if user has access to itinerary
  // =============================================
  private async checkAccess(userId: number, itineraryId: number): Promise<boolean> {
    const result = await pool.query(`
      SELECT 1 FROM itineraries WHERE id = $1 AND user_id = $2
      UNION
      SELECT 1 FROM itinerary_collaborators WHERE itinerary_id = $3 AND user_id = $4 AND status = 'accepted'
    `, [itineraryId, userId, itineraryId, userId]);

    return result.rows.length > 0;
  }
}

export const collaborationChatController = new CollaborationChatController();
