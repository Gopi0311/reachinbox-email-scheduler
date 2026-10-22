import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { AuthUser } from '../types/index.js';

export class AuthController {
  public static getCurrentUser(req: Request, res: Response): void {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: req.user,
    });
  }

  public static handleGoogleCallback(req: Request, res: Response): void {
    logger.info({ user: req.user }, 'Google OAuth callback succeeded');
    res.redirect(`${env.FRONTEND_URL}/dashboard`);
  }

  public static logout(req: Request, res: Response, next: NextFunction): void {
    req.logout((err) => {
      if (err) {
        return next(err);
      }
      req.session.destroy((destroyErr) => {
        if (destroyErr) {
          logger.warn({ destroyErr }, 'Error destroying session on logout');
        }
        res.clearCookie('connect.sid');
        res.status(200).json({
          success: true,
          message: 'Logged out successfully',
        });
      });
    });
  }

  /**
   * Dev/Test login for evaluation environments where Google Cloud OAuth client is not yet registered.
   * Enabled in development and test environments.
   */
  public static async devLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (env.NODE_ENV === 'production') {
      res.status(403).json({ success: false, error: 'Dev login not allowed in production' });
      return;
    }

    try {
      const email = req.body.email || 'demo.user@reachinbox.ai';
      const name = req.body.name || 'Demo ReachInbox User';

      let user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            googleId: `dev_${Date.now()}`,
            email,
            name,
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ReachInbox',
          },
        });

        await prisma.sender.create({
          data: {
            userId: user.id,
            email,
            name,
            hourlyLimit: env.MAX_EMAILS_PER_HOUR,
            minDelayMs: env.MIN_EMAIL_DELAY_MS,
          },
        });
      }

      const authUser: AuthUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        googleId: user.googleId,
      };

      req.login(authUser, (loginErr) => {
        if (loginErr) {
          return next(loginErr);
        }
        res.status(200).json({
          success: true,
          data: authUser,
          message: 'Dev logged in successfully',
        });
      });
    } catch (error) {
      next(error);
    }
  }
}
