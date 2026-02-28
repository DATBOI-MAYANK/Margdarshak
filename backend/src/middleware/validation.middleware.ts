import { body, param, ValidationChain } from 'express-validator';

export const registerValidation: ValidationChain[] = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['Traveler', 'Admin']).withMessage('Role must be Traveler or Admin'),
  body('contact_info').optional().trim()
];

export const loginValidation: ValidationChain[] = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
];

export const itineraryValidation: ValidationChain[] = [
  body('destination').trim().notEmpty().withMessage('Destination is required'),
  body('start_date').isISO8601().withMessage('Valid start date is required'),
  body('end_date').isISO8601().withMessage('Valid end date is required')
    .custom((value, { req }) => {
      if (new Date(value) < new Date(req.body.start_date)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
  body('budget').isFloat({ min: 0.01 }).withMessage('Budget must be greater than zero'),
  body('activities').optional().isArray().withMessage('Activities must be an array'),
  body('notes').optional().trim(),
  body('preferences').optional().trim()
];

export const idValidation: ValidationChain[] = [
  param('id').isInt({ min: 1 }).withMessage('Invalid ID')
];
