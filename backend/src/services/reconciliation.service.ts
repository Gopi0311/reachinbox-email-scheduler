import { prisma } from '../db/prisma.js';
import { logger } from '../config/logger.js';
import { addDelayedEmailJob, getBullMQJob } from '../queues/email.queue.js';
import { EmailJobStatus } from '@prisma/client';
import { env } from '../config/env.js';

export interface ReconciliationReport {
  recoveredProcessingCount: number;
  requeuedScheduledCount: number;
}

export class ReconciliationService {
  /**
   * Reconciles database state with BullMQ queue on startup.
   * 1. Safely recovers jobs stuck in 'processing' (e.g. from server crashes or sudden restarts).
   * 2. Checks all 'scheduled' / 'rescheduled' rows and re-enqueues any that are missing from BullMQ.
   */
  public static async reconcile(): Promise<ReconciliationReport> {
    logger.info('Starting database-to-queue startup reconciliation...');

    let recoveredProcessingCount = 0;
    let requeuedScheduledCount = 0;

    try {
      // 1. Recover jobs stuck in 'processing'
      // Revert them back to 'scheduled' so they can be processed
      const stuckJobs = await prisma.emailJob.findMany({
        where: {
          status: EmailJobStatus.PROCESSING,
        },
      });

      if (stuckJobs.length > 0) {
        logger.warn(
          { count: stuckJobs.length },
          'Found email jobs stuck in PROCESSING state from previous shutdown/crash. Recovering...'
        );

        for (const job of stuckJobs) {
          await prisma.emailJob.update({
            where: { id: job.id },
            data: {
              status: EmailJobStatus.SCHEDULED,
            },
          });
          recoveredProcessingCount++;
        }
      }

      // 2. Find all SCHEDULED and RESCHEDULED ("rate_limited") jobs in DB
      const pendingJobs = await prisma.emailJob.findMany({
        where: {
          status: { in: [EmailJobStatus.SCHEDULED, EmailJobStatus.RESCHEDULED] },
        },
        include: { sender: true },
      });

      for (const job of pendingJobs) {
        const existingBullJob = await getBullMQJob(job.id);
        let hasActiveJobInQueue = false;

        if (existingBullJob) {
          try {
            const state =
              typeof existingBullJob.getState === 'function'
                ? await existingBullJob.getState()
                : 'active';
            if (
              state === 'delayed' ||
              state === 'waiting' ||
              state === 'active' ||
              state === 'prioritized'
            ) {
              hasActiveJobInQueue = true;
            } else {
              // Job was marked completed/failed in BullMQ, but DB is still scheduled/rescheduled.
              // Remove the old completed/failed job so it can be re-enqueued clean.
              if (typeof existingBullJob.remove === 'function') {
                await existingBullJob.remove().catch(() => {});
              }
            }
          } catch {
            hasActiveJobInQueue = false;
          }
        }

        // If job has no active/delayed/waiting job in BullMQ, re-queue it.
        // If scheduledAt is already in the past, add with delay 0 so it sends immediately.
        if (!hasActiveJobInQueue) {
          const now = Date.now();
          const targetTime = job.scheduledAt.getTime();
          const delayMs = Math.max(0, targetTime - now);

          await addDelayedEmailJob(
            {
              jobId: job.id,
              userId: job.userId,
              senderId: job.senderId ?? undefined,
              toEmail: job.toEmail,
              subject: job.subject,
              body: job.body,
              hourlyLimit: job.sender?.hourlyLimit ?? env.MAX_EMAILS_PER_HOUR,
              minDelayMs: job.sender?.minDelayMs ?? env.MIN_EMAIL_DELAY_MS,
              scheduledTime: targetTime,
            },
            delayMs
          );

          requeuedScheduledCount++;
        }
      }

      logger.info(
        {
          recoveredProcessingCount,
          requeuedScheduledCount,
          totalPendingInDb: pendingJobs.length,
        },
        'Startup reconciliation complete. Queue is synchronized with database.'
      );

      return {
        recoveredProcessingCount,
        requeuedScheduledCount,
      };
    } catch (error) {
      logger.error({ error }, 'Error during startup reconciliation');
      return {
        recoveredProcessingCount,
        requeuedScheduledCount,
      };
    }
  }
}
