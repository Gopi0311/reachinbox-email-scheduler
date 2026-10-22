import { Router } from 'express';
import { SlackController } from '../controllers/slack.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const slackRouter = Router();

// Callback does not require session beforehand because it's an OAuth redirect,
// but state contains validated encoded userId
slackRouter.get('/callback', SlackController.handleCallback);

// All other Slack endpoints require authentication
slackRouter.get('/connect', requireAuth, SlackController.connect);
slackRouter.get('/status', requireAuth, SlackController.getStatus);
slackRouter.post('/disconnect', requireAuth, SlackController.disconnect);
slackRouter.post('/test', requireAuth, SlackController.testNotification);
