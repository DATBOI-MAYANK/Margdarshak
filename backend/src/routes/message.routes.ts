import { Router } from 'express';
import { messageController } from '../controllers/message.controller';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// =============================================
// User routes (all authenticated users)
// =============================================

// Get user's messages
router.get('/', (req, res) => messageController.getMessages(req, res));

// Get notifications
router.get('/notifications', (req, res) => messageController.getNotifications(req, res));

// Get message thread
router.get('/thread/:messageId', (req, res) => messageController.getMessageThread(req, res));

// Mark message as read
router.put('/:messageId/read', (req, res) => messageController.markMessageRead(req, res));

// Mark notification as read
router.put('/notifications/:notificationId/read', (req, res) => messageController.markNotificationRead(req, res));

// Mark all notifications as read
router.put('/notifications/read-all', (req, res) => messageController.markAllNotificationsRead(req, res));

// Delete notification
router.delete('/notifications/:notificationId', (req, res) => messageController.deleteNotification(req, res));

// =============================================
// Traveler routes
// =============================================

// Send support/contact message
router.post('/support', (req, res) => messageController.sendSupportMessage(req, res));

// =============================================
// Admin routes
// =============================================

// Send broadcast to all travelers
router.post('/broadcast', authorizeRoles('Admin'), (req, res) => messageController.sendBroadcast(req, res));

// Send message to specific user
router.post('/send/:userId', authorizeRoles('Admin'), (req, res) => messageController.sendToUser(req, res));

// Get support tickets
router.get('/support/tickets', authorizeRoles('Admin'), (req, res) => messageController.getSupportTickets(req, res));

// Reply to support message
router.post('/support/:messageId/reply', authorizeRoles('Admin'), (req, res) => messageController.replySupportMessage(req, res));

export default router;
