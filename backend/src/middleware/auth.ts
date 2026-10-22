import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from './error.js';

export const requireAuth = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.isAuthenticated && req.isAuthenticated() && req.user) {
    return next();
  }
  throw new UnauthorizedError('Authentication required. Please sign in with Google.');
};

export const optionalAuth = (req: Request, _res: Response, next: NextFunction): void => {
  next();
};
