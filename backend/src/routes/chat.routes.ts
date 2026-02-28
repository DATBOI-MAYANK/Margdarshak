import { Router } from 'express';
import { collaborationChatController } from '../controllers/chat.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Get unread chat counts
router.get('/unread/counts', (req, res) => collaborationChatController.getUnreadChatCounts(req, res));

// Get chat messages for an itinerary
router.get('/:itineraryId', (req, res) => collaborationChatController.getChatMessages(req, res));

// Send chat message
router.post('/:itineraryId', (req, res) => collaborationChatController.sendChatMessage(req, res));

// Delete chat message
router.delete('/message/:messageId', (req, res) => collaborationChatController.deleteChatMessage(req, res));

export default router;
