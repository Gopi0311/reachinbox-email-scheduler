import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import session from 'express-session';
import { RedisStore } from 'connect-redis';
import passport from './config/passport.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { redisClient } from './config/redis.js';
import { errorHandler } from './middleware/error.js';
import { apiRouter } from './routes/index.js';
import { authRouter } from './routes/auth.routes.js';
import { bullBoardRouter } from './queues/bull-board.js';

export const createApp = (): Express => {
  const app = express();

  // Basic security and parsing middleware
  app.set('trust proxy', 1);
  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Session configuration with Redis store
  let sessionStore;
  try {
    sessionStore = new RedisStore({
      client: redisClient,
      prefix: 'reachinbox:sess:',
    });
  } catch (err) {
    logger.warn('Using MemoryStore for session');
  }

  app.use(
    session({
      store: sessionStore,
      secret: env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      proxy: true,
      cookie: {
        secure: env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
        sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
      },
    })
  );

  // Passport middleware initialization
  app.use(passport.initialize());
  app.use(passport.session());

  // Healthcheck endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      service: 'reachinbox-scheduler-backend',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // Bull Board Queue UI monitoring (accessible at /admin/queues)
  app.use('/admin/queues', bullBoardRouter);

  // Direct Auth routes (/auth/google, /auth/google/callback, /auth/me, /auth/logout)
  app.use('/auth', authRouter);

  // API router (/api/emails, /api/slack, /api/auth)
  app.use('/api', apiRouter);

  // Central error handler
  app.use(errorHandler);

  return app;
};
