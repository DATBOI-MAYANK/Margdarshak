import { Router, Request, Response } from 'express';
import multer from 'multer';
import { AuthController } from '../controllers/auth.controller';
import { registerValidation, loginValidation } from '../middleware/validation.middleware';
import { authenticateToken, authorizeRoles, AuthRequest } from '../middleware/auth.middleware';

const router = Router();
const authController = new AuthController();

// Configure multer to use memory storage (buffer) so we can convert to base64
// This avoids relying on the filesystem which gets wiped on redeploy
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images are allowed.'));
    }
  },
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB limit (stored as base64 in DB)
});

router.post('/register', registerValidation, (req: Request, res: Response) => authController.register(req, res));
router.post('/login', loginValidation, (req: Request, res: Response) => authController.login(req, res));
router.get('/profile', authenticateToken, (req: Request, res: Response) => authController.getProfile(req as AuthRequest, res));
router.put('/profile', authenticateToken, (req: Request, res: Response) => authController.updateProfile(req as AuthRequest, res));
router.post('/profile/picture', authenticateToken, upload.single('profile_picture'), (req: Request, res: Response) => authController.uploadProfilePicture(req as AuthRequest, res));
router.delete('/profile/picture', authenticateToken, (req: Request, res: Response) => authController.removeProfilePicture(req as AuthRequest, res));
router.put('/change-password', authenticateToken, (req: Request, res: Response) => authController.changePassword(req as AuthRequest, res));
router.get('/users', authenticateToken, authorizeRoles('Admin'), (req: Request, res: Response) => authController.getAllUsers(req as AuthRequest, res));

// Admin user management routes
router.get('/users/stats', authenticateToken, authorizeRoles('Admin'), (req: Request, res: Response) => authController.getUserStats(req as AuthRequest, res));
router.put('/users/:userId/role', authenticateToken, authorizeRoles('Admin'), (req: Request, res: Response) => authController.updateUserRole(req as AuthRequest, res));
router.put('/users/:userId/status', authenticateToken, authorizeRoles('Admin'), (req: Request, res: Response) => authController.updateUserStatus(req as AuthRequest, res));
router.delete('/users/:userId', authenticateToken, authorizeRoles('Admin'), (req: Request, res: Response) => authController.deleteUser(req as AuthRequest, res));

export default router;
