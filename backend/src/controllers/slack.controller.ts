import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { SlackService } from '../services/slack.service.js';

export class SlackController {
  /**
   * Initiate Slack OAuth 2.0 authorization
   */
  public static connect(req: Request, res: Response): void {
    const userId = req.user!.id;
    const redirectUri = `${env.BACKEND_URL}/api/slack/callback`;
    const scopes = ['chat:write', 'incoming-webhook'].join(',');

    // Encode state with userId
    const state = Buffer.from(JSON.stringify({ userId, timestamp: Date.now() })).toString('base64');

    const slackAuthUrl = `https://slack.com/oauth/v2/authorize?client_id=${encodeURIComponent(
      env.SLACK_CLIENT_ID
    )}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&state=${encodeURIComponent(state)}`;

    res.json({
      success: true,
      data: { authUrl: slackAuthUrl },
    });
  }

  /**
   * Handle Slack OAuth callback
   */
  public static async handleCallback(req: Request, res: Response): Promise<void> {
    const { code, state, error } = req.query;

    if (error) {
      logger.warn({ error }, 'Slack OAuth was denied or returned an error');
      res.redirect(`${env.FRONTEND_URL}/dashboard?slack=error&message=${encodeURIComponent(String(error))}`);
      return;
    }

    if (!code || !state) {
      res.redirect(`${env.FRONTEND_URL}/dashboard?slack=error&message=Missing_authorization_code`);
      return;
    }

    try {
      const decodedState = JSON.parse(Buffer.from(String(state), 'base64').toString('utf-8'));
      const userId = decodedState.userId;

      if (!userId) {
        res.redirect(`${env.FRONTEND_URL}/dashboard?slack=error&message=Invalid_state`);
        return;
      }

      const redirectUri = `${env.BACKEND_URL}/api/slack/callback`;
      const tokenData = await SlackService.exchangeOAuthCode(String(code), redirectUri);

      if (!tokenData.ok) {
        logger.error({ tokenData }, 'Slack token exchange failed');
        res.redirect(`${env.FRONTEND_URL}/dashboard?slack=error&message=${encodeURIComponent(tokenData.error || 'Token_exchange_failed')}`);
        return;
      }

      // Upsert the connection for this user
      await prisma.slackConnection.upsert({
        where: {
          userId_teamId: {
            userId,
            teamId: tokenData.team?.id || 'unknown_team',
          },
        },
        create: {
          userId,
          teamId: tokenData.team?.id || null,
          teamName: tokenData.team?.name || 'Slack Team',
          accessToken: tokenData.access_token || '',
          botUserId: tokenData.bot_user_id || null,
          incomingWebhookUrl: tokenData.incoming_webhook?.url || null,
          channel: tokenData.incoming_webhook?.channel || null,
          scope: tokenData.scope || null,
        },
        update: {
          teamName: tokenData.team?.name || 'Slack Team',
          accessToken: tokenData.access_token || '',
          botUserId: tokenData.bot_user_id || null,
          incomingWebhookUrl: tokenData.incoming_webhook?.url || null,
          channel: tokenData.incoming_webhook?.channel || null,
          scope: tokenData.scope || null,
        },
      });

      logger.info({ userId, teamName: tokenData.team?.name }, 'Slack successfully connected for user');
      res.redirect(`${env.FRONTEND_URL}/dashboard?slack=connected`);
    } catch (err: any) {
      logger.error({ error: err.message }, 'Unexpected error in Slack callback');
      res.redirect(`${env.FRONTEND_URL}/dashboard?slack=error&message=Internal_error`);
    }
  }

  /**
   * Get current Slack connection status
   */
  public static async getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const connection = await prisma.slackConnection.findFirst({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
      });

      res.status(200).json({
        success: true,
        data: {
          isConnected: !!connection,
          teamName: connection?.teamName || null,
          channel: connection?.channel || null,
          connectedAt: connection?.createdAt || null,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Disconnect Slack
   */
  public static async disconnect(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      await prisma.slackConnection.deleteMany({
        where: { userId },
      });

      res.status(200).json({
        success: true,
        message: 'Slack disconnected successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Send a test Slack notification
   */
  public static async testNotification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const sent = await SlackService.notifyRateLimitExceeded({
        userId,
        senderEmail: req.user!.email,
        limit: 100,
        currentCount: 100,
        nextWindowDate: new Date(Date.now() + 3600000),
      });

      res.status(200).json({
        success: true,
        sent,
        message: sent ? 'Test notification sent to Slack' : 'Could not send test message (check connection)',
      });
    } catch (error) {
      next(error);
    }
  }
}
