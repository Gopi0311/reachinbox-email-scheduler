import { Router } from 'express';
import { authRouter } from './auth.routes.js';
import { emailRouter } from './email.routes.js';
import { slackRouter } from './slack.routes.js';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/emails', emailRouter);
apiRouter.use('/slack', slackRouter);
