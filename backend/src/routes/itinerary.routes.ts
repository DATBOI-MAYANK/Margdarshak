import { Router, Request, Response } from 'express';
import { ItineraryController } from '../controllers/itinerary.controller';
import { itineraryValidation, idValidation } from '../middleware/validation.middleware';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware';

const router = Router();
const itineraryController = new ItineraryController();

// User routes
router.post('/', authenticateToken, itineraryValidation, (req: Request, res: Response) => 
  itineraryController.createItinerary(req, res)
);

router.get('/', authenticateToken, (req: Request, res: Response) => 
  itineraryController.getAllItineraries(req, res)
);

router.get('/:id', authenticateToken, idValidation, (req: Request, res: Response) => 
  itineraryController.getItineraryById(req, res)
);

router.put('/:id', authenticateToken, idValidation, itineraryValidation, (req: Request, res: Response) => 
  itineraryController.updateItinerary(req, res)
);

router.delete('/:id', authenticateToken, idValidation, (req: Request, res: Response) => 
  itineraryController.deleteItinerary(req, res)
);

// Regenerate activities for an itinerary
router.post('/:id/regenerate', authenticateToken, idValidation, (req: Request, res: Response) =>
  itineraryController.regenerateActivities(req, res)
);

// Admin routes
router.get('/admin/all', authenticateToken, authorizeRoles('Admin'), (req: Request, res: Response) => 
  itineraryController.getAllItinerariesAdmin(req, res)
);

router.get('/admin/analytics', authenticateToken, authorizeRoles('Admin'), (req: Request, res: Response) => 
  itineraryController.getAnalytics(req, res)
);

export default router;
