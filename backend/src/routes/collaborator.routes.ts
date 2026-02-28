import { Router } from 'express';
import { collaboratorController } from '../controllers/collaborator.controller';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Admin: Get all collaborations across all itineraries
router.get('/admin/all', authorizeRoles('Admin'), (req, res) => collaboratorController.getAllCollaborations(req, res));

// Get itineraries shared with current user (accepted invites)
router.get('/shared-with-me', (req, res) => collaboratorController.getSharedWithMe(req, res));

// Get pending invitations for current user
router.get('/pending-invites', (req, res) => collaboratorController.getPendingInvites(req, res));

// Accept an invitation
router.put('/invites/:inviteId/accept', (req, res) => collaboratorController.acceptInvite(req, res));

// Reject an invitation
router.put('/invites/:inviteId/reject', (req, res) => collaboratorController.rejectInvite(req, res));

// Get collaborators for an itinerary
router.get('/:itineraryId', (req, res) => collaboratorController.getCollaborators(req, res));

// Invite a collaborator
router.post('/:itineraryId/invite', (req, res) => collaboratorController.inviteCollaborator(req, res));

// Update collaborator permission
router.put('/:itineraryId/:collaboratorId', (req, res) => collaboratorController.updatePermission(req, res));

// Remove a collaborator
router.delete('/:itineraryId/:collaboratorId', (req, res) => collaboratorController.removeCollaborator(req, res));

export default router;
