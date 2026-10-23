import { Worker, Job, DelayedError } from 'bullmq';
import { EMAIL_QUEUE_NAME } from '../queues/email.queue.js';
import { createRedisConnection } from '../config/redis.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { EmailJobData } from '../types/index.js';
import { EmailSenderService } from '../services/email-sender.service.js';

export const processEmailJob = async (job: Job<EmailJobData>, token?: string) => {
  logger.info({ jobId: job.id, toEmail: job.data.toEmail }, 'Worker picked up email job');

  const result = await EmailSenderService.processAndSend(job.data);

  if (result.status === 'rescheduled') {
    logger.info(
      { jobId: job.id, delayTimestamp: result.delayTimestamp, retryAfterMs: result.retryAfterMs },
      'Email job hit hourly rate limit; moving job to delayed set in BullMQ'
    );
    await job.moveToDelayed(result.delayTimestamp, token);
    throw new DelayedError();
  }

  if (result.status === 'already_processed') {
    logger.info({ jobId: job.id }, 'Email job was already processed; safely skipped');
    return { status: 'already_processed' };
  }

  if (result.status === 'failed') {
    logger.warn({ jobId: job.id, error: result.error }, 'Email job execution failed');
    // Do not throw if it was recorded as FAILED in DB to avoid uncontrolled infinite retries,
    // or return failure details.
    return { status: 'failed', error: result.error };
  }

  return {
    status: 'sent',
    messageId: result.messageId,
    previewUrl: result.previewUrl,
  };
};

export const createEmailWorker = (concurrency = env.WORKER_CONCURRENCY) => {
  logger.info({ concurrency, queue: EMAIL_QUEUE_NAME }, 'Initializing BullMQ Email Worker...');

  const worker = new Worker<EmailJobData>(
    EMAIL_QUEUE_NAME,
    processEmailJob,
    {
      connection: createRedisConnection(),
      concurrency,
      lockDuration: 30000,
    }
  );

  worker.on('ready', () => {
    logger.info('Email Worker is online and listening for delayed/active jobs');
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'Email Worker encountered an error');
  });

  worker.on('failed', (job, err) => {
    if (err instanceof DelayedError || err?.name === 'DelayedError') {
      return;
    }
    logger.error({ jobId: job?.id, err }, 'Email Worker job processing failed');
  });

  return worker;
};
