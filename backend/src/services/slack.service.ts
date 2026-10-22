import { prisma } from '../db/prisma.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

export interface SlackRateLimitAlertData {
  userId: string;
  senderEmail: string;
  limit: number;
  currentCount: number;
  nextWindowDate: Date;
  rescheduledCount?: number;
}

export class SlackService {
  /**
   * Send an alert notification to Slack when a sender hits the hourly rate limit.
   * If Slack is not connected, fails silently and gracefully without breaking the scheduling flow.
   */
  public static async notifyRateLimitExceeded(data: SlackRateLimitAlertData): Promise<boolean> {
    try {
      const connection = await prisma.slackConnection.findFirst({
        where: { userId: data.userId },
        orderBy: { updatedAt: 'desc' },
      });

      if (!connection) {
        logger.debug({ userId: data.userId }, 'No Slack connection configured for user; skipping alert');
        return false;
      }

      const messageBlocks = {
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '⚠️ Email Scheduler: Hourly Limit Reached',
              emoji: true,
            },
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Sender:*\n\`${data.senderEmail}\``,
              },
              {
                type: 'mrkdwn',
                text: `*Hourly Limit:*\n*${data.limit}* emails/hour`,
              },
              {
                type: 'mrkdwn',
                text: `*Current Sent:*\n*${data.currentCount}* emails`,
              },
              {
                type: 'mrkdwn',
                text: `*Next Sending Window:*\n<!date^${Math.floor(
                  data.nextWindowDate.getTime() / 1000
                )}^{date_num} {time_secs}|${data.nextWindowDate.toISOString()}>`,
              },
            ],
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: 'ℹ️ *Action taken:* Pending jobs have been automatically rescheduled to the next window. No emails were dropped.',
              },
            ],
          },
        ],
      };

      // 1. Try incoming webhook URL if present
      if (connection.incomingWebhookUrl) {
        const response = await fetch(connection.incomingWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(messageBlocks),
        });

        if (response.ok) {
          logger.info({ userId: data.userId }, 'Dispatched Slack rate limit notification via webhook');
          return true;
        }
      }

      // 2. Fall back to chat.postMessage API using bot access token
      if (connection.accessToken && connection.channel) {
        const response = await fetch('https://slack.com/api/chat.postMessage', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            Authorization: `Bearer ${connection.accessToken}`,
          },
          body: JSON.stringify({
            channel: connection.channel,
            ...messageBlocks,
          }),
        });

        const result: any = await response.json();
        if (result.ok) {
          logger.info({ userId: data.userId }, 'Dispatched Slack rate limit notification via chat.postMessage');
          return true;
        } else {
          logger.warn({ error: result.error, userId: data.userId }, 'Slack chat.postMessage returned an error');
        }
      }

      return false;
    } catch (error: any) {
      logger.error({ error: error.message, userId: data.userId }, 'Failed to send Slack rate limit alert');
      return false;
    }
  }

  /**
   * Exchange OAuth authorization code for Slack access tokens & webhooks
   */
  public static async exchangeOAuthCode(code: string, redirectUri: string) {
    const params = new URLSearchParams({
      client_id: env.SLACK_CLIENT_ID,
      client_secret: env.SLACK_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    });

    const response = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data: any = await response.json();
    return data;
  }
}
