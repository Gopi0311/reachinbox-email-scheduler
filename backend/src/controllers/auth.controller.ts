import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

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
}
