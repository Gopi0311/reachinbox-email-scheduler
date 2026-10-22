import { Router } from 'express';
import passport from 'passport';
import { AuthController } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const authRouter = Router();

// Google OAuth authentication route
authRouter.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account',
  })
);

// Google OAuth callback route
authRouter.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/auth/failure',
  }),
  AuthController.handleGoogleCallback
);

authRouter.get('/failure', (_req, res) => {
  res.status(401).json({
    success: false,
    error: 'Google authentication failed',
  });
});

// Current user profile
authRouter.get('/me', requireAuth, AuthController.getCurrentUser);

// Logout
authRouter.post('/logout', AuthController.logout);
