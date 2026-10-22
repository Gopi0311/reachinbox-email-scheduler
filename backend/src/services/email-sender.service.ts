import nodemailer from 'nodemailer';
import { prisma } from '../db/prisma.js';
import { getEmailTransporter } from '../config/email.js';
import { logger } from '../config/logger.js';
import { RateLimiterService } from './rate-limiter.service.js';
import { ElasticsearchService } from './elasticsearch.service.js';
import { SlackService } from './slack.service.js';
import { addDelayedEmailJob } from '../queues/email.queue.js';
import { EmailJobData } from '../types/index.js';
import { EmailJob, EmailJobStatus, Prisma } from '@prisma/client';

export type ClaimedEmailJob = Prisma.EmailJobGetPayload<{
  include: { sender: true; user: true };
}>;

export type SendResult =
  | { status: 'already_processed' }
  | { status: 'rescheduled'; retryAfterMs: number }
  | { status: 'sent'; messageId: string; previewUrl: string | null }
  | { status: 'failed'; error: string };

export class EmailSenderService {
  /**
   * Atomically claims the email job from the database.
   * Ensures STRICT IDEMPOTENCY: only one worker can transition from SCHEDULED/RESCHEDULED to PROCESSING.
   */
  public static async claimJob(jobId: string): Promise<ClaimedEmailJob | null> {
    try {
      // Prisma atomic update with conditional where clause
      // We check that the job is currently SCHEDULED or RESCHEDULED
      const job = await prisma.emailJob.findUnique({
        where: { id: jobId },
      });

      if (!job) {
        logger.warn({ jobId }, 'Job record not found in database');
        return null;
      }

      if (job.status !== EmailJobStatus.SCHEDULED && job.status !== EmailJobStatus.RESCHEDULED) {
        logger.info(
          { jobId, currentStatus: job.status },
          'Job is not in scheduled or rescheduled state; skipping duplicate processing'
        );
        return null;
      }

      // Perform atomic update: only succeed if status hasn't changed
      const updated = await prisma.emailJob.updateMany({
        where: {
          id: jobId,
          status: { in: [EmailJobStatus.SCHEDULED, EmailJobStatus.RESCHEDULED] },
        },
        data: {
          status: EmailJobStatus.PROCESSING,
          attempts: { increment: 1 },
        },
      });

      if (updated.count === 0) {
        logger.info({ jobId }, 'Concurrent worker claimed this job first; skipping');
        return null;
      }

      // Return fresh record
      return await prisma.emailJob.findUnique({
        where: { id: jobId },
        include: { sender: true, user: true },
      });
    } catch (error) {
      logger.error({ error, jobId }, 'Failed to claim email job');
      return null;
    }
  }

  /**
   * Process and execute sending the email job, enforcing delays and rate limits.
   */
  public static async processAndSend(jobData: EmailJobData): Promise<SendResult> {
    const { jobId, userId, senderId, toEmail, subject, body, hourlyLimit, minDelayMs } = jobData;

    // 1. Atomic claim check
    const claimedJob = await this.claimJob(jobId);
    if (!claimedJob) {
      return { status: 'already_processed' };
    }

    const effectiveSenderId = senderId || userId;
    const senderEmail = claimedJob.sender?.email || claimedJob.user?.email || 'noreply@reachinbox.ai';

    try {
      // 2. Enforce minimum delay between emails for this sender
      await RateLimiterService.enforceMinDelay(effectiveSenderId, minDelayMs);

      // 3. Check and increment hourly rate limit
      const rateLimitResult = await RateLimiterService.checkHourlyLimit(
        effectiveSenderId,
        hourlyLimit
      );

      // 4. If rate limit is exceeded, RESCHEDULE instead of dropping or failing!
      if (!rateLimitResult.allowed) {
        const retryAfterMs = rateLimitResult.retryAfterMs || 3600000;
        const newScheduledAt = new Date(Date.now() + retryAfterMs);

        // Revert status to RESCHEDULED in DB
        const rescheduledJob = await prisma.emailJob.update({
          where: { id: jobId },
          data: {
            status: EmailJobStatus.RESCHEDULED,
            scheduledAt: newScheduledAt,
          },
        });

        // Re-enqueue delayed job in BullMQ
        await addDelayedEmailJob(
          {
            ...jobData,
            scheduledTime: newScheduledAt.getTime(),
          },
          retryAfterMs
        );

        logger.info(
          {
            jobId,
            toEmail,
            retryAfterMs,
            rescheduledTo: newScheduledAt.toISOString(),
          },
          'Email job rescheduled to next hour window due to rate limit'
        );

        // Notify via Slack if configured
        await SlackService.notifyRateLimitExceeded({
          userId,
          senderEmail,
          limit: hourlyLimit,
          currentCount: rateLimitResult.currentCount,
          nextWindowDate: rateLimitResult.nextWindowDate || newScheduledAt,
        });

        // Update Elasticsearch with rescheduled status
        await ElasticsearchService.indexEmailJob(rescheduledJob);

        return { status: 'rescheduled', retryAfterMs };
      }

      // 5. Send email via Ethereal SMTP
      const transporter = await getEmailTransporter();
      const mailOptions = {
        from: `"${claimedJob.user?.name || 'ReachInbox Scheduler'}" <${senderEmail}>`,
        to: toEmail,
        subject,
        text: body,
        html: `<div style="font-family: sans-serif; line-height: 1.6; color: #333;">${body.replace(
          /\n/g,
          '<br/>'
        )}</div>`,
      };

      const info = await transporter.sendMail(mailOptions);
      const previewUrl = nodemailer.getTestMessageUrl(info) || null;

      logger.info(
        {
          jobId,
          toEmail,
          messageId: info.messageId,
          previewUrl,
        },
        'Email sent successfully via Ethereal'
      );

      // 6. Record successful send timestamp for minimum delay tracker
      await RateLimiterService.recordSend(effectiveSenderId);

      // 7. Update DB record to SENT
      const sentJob = await prisma.emailJob.update({
        where: { id: jobId },
        data: {
          status: EmailJobStatus.SENT,
          sentAt: new Date(),
          messageId: info.messageId,
          previewUrl: previewUrl ? String(previewUrl) : null,
          error: null,
        },
      });

      // 8. Index in Elasticsearch
      await ElasticsearchService.indexEmailJob(sentJob);

      return {
        status: 'sent',
        messageId: info.messageId,
        previewUrl: previewUrl ? String(previewUrl) : null,
      };
    } catch (error: any) {
      logger.error({ error: error.message, jobId, toEmail }, 'Failed to deliver email');

      // Update DB record to FAILED
      const failedJob = await prisma.emailJob.update({
        where: { id: jobId },
        data: {
          status: EmailJobStatus.FAILED,
          error: error.message || 'Unknown sending error',
        },
      });

      // Index failure in Elasticsearch
      await ElasticsearchService.indexEmailJob(failedJob);

      return {
        status: 'failed',
        error: error.message || 'Unknown sending error',
      };
    }
  }
}
