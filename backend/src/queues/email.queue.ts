import { Queue, QueueEvents, Job } from 'bullmq';
import { createRedisConnection } from '../config/redis.js';
import { logger } from '../config/logger.js';
import { EmailJobData } from '../types/index.js';

export const EMAIL_QUEUE_NAME = 'email-scheduler-queue';

export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      age: 24 * 3600, // keep for 24h
      count: 2000,
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // keep failures for 7 days
      count: 5000,
    },
  },
});

export const emailQueueEvents = new QueueEvents(EMAIL_QUEUE_NAME, {
  connection: createRedisConnection(),
});

emailQueueEvents.on('completed', ({ jobId }) => {
  logger.info({ jobId }, 'BullMQ job completed successfully');
});

emailQueueEvents.on('failed', ({ jobId, failedReason }) => {
  logger.error({ jobId, failedReason }, 'BullMQ job failed');
});

/**
 * Add a delayed email job to BullMQ
 * The jobId MUST match the database EmailJob.id to guarantee uniqueness and idempotency.
 */
export const addDelayedEmailJob = async (
  data: EmailJobData,
  delayMs: number
): Promise<Job<EmailJobData>> => {
  const safeDelay = Math.max(0, delayMs);
  const job = await emailQueue.add(
    'send-email',
    data,
    {
      jobId: data.jobId, // STABLE JOB ID = DB record ID
      delay: safeDelay,
    }
  );

  logger.info(
    {
      jobId: job.id,
      toEmail: data.toEmail,
      delayMs: safeDelay,
      scheduledFor: new Date(Date.now() + safeDelay).toISOString(),
    },
    'Delayed email job enqueued into BullMQ'
  );

  return job;
};

/**
 * Check if a job exists in BullMQ (active, delayed, or waiting)
 */
export const getBullMQJob = async (jobId: string): Promise<Job<EmailJobData> | undefined> => {
  return (await emailQueue.getJob(jobId)) ?? undefined;
};

/**
 * Remove/Cancel a job from BullMQ if scheduled
 */
export const removeBullMQJob = async (jobId: string): Promise<boolean> => {
  try {
    const job = await emailQueue.getJob(jobId);
    if (job) {
      await job.remove();
      return true;
    }
    return false;
  } catch (error) {
    logger.warn({ jobId, error }, 'Could not remove BullMQ job');
    return false;
  }
};
