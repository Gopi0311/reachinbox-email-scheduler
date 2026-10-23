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