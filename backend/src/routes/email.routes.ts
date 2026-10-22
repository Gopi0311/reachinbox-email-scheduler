import { Router } from 'express';
import { z } from 'zod';
import { EmailController } from '../controllers/email.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';

export const emailRouter = Router();

// Protect all email endpoints with authentication
emailRouter.use(requireAuth);

const scheduleEmailSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required'),
  recipientEmails: z.array(z.string().email('Invalid email address')).min(1, 'At least one recipient is required'),
  startTime: z.string().datetime().optional(),
  delayBetweenEmailsMs: z.coerce.number().min(0).optional(),
  hourlyLimit: z.coerce.number().min(1).optional(),
  senderId: z.string().optional(),
});

emailRouter.post(
  '/schedule',
  validate({ body: scheduleEmailSchema }),
  EmailController.schedule
);

emailRouter.get('/scheduled', EmailController.getScheduled);
emailRouter.get('/sent', EmailController.getSent);
emailRouter.get('/search', EmailController.search);
emailRouter.get('/stats', EmailController.getStats);
emailRouter.get('/:id', EmailController.getById);
emailRouter.delete('/:id', EmailController.cancel);
