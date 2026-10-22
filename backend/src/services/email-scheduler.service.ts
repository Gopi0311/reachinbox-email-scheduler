import { prisma } from '../db/prisma.js';
import { addDelayedEmailJob } from '../queues/email.queue.js';
import { ElasticsearchService } from './elasticsearch.service.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';
import { EmailJobStatus } from '@prisma/client';
import { ScheduleEmailsDto } from '../types/index.js';

export interface ScheduleEmailsResult {
  scheduledCount: number;
  batchId: string;
  firstScheduledAt: Date;
  lastScheduledAt: Date;
  jobIds: string[];
}

export class EmailSchedulerService {
  /**
   * Schedule a batch of emails.
   * Persists all rows in PostgreSQL with stable IDs, then creates BullMQ delayed jobs.
   */
  public static async scheduleEmails(
    userId: string,
    dto: ScheduleEmailsDto
  ): Promise<ScheduleEmailsResult> {
    const {
      subject,
      body,
      recipientEmails,
      startTime = new Date(),
      delayBetweenEmailsMs = env.MIN_EMAIL_DELAY_MS,
      hourlyLimit = env.MAX_EMAILS_PER_HOUR,
      senderId,
    } = dto;

    // Filter valid emails & deduplicate in the current batch
    const sanitizedRecipients = Array.from(
      new Set(
        recipientEmails
          .map((e) => e.trim().toLowerCase())
          .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
      )
    );

    if (sanitizedRecipients.length === 0) {
      throw new Error('No valid recipient email addresses provided');
    }

    const startTimestamp = Math.max(Date.now(), new Date(startTime).getTime());
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    logger.info(
      {
        userId,
        recipientCount: sanitizedRecipients.length,
        delayBetweenEmailsMs,
        hourlyLimit,
        startTimestamp: new Date(startTimestamp).toISOString(),
      },
      'Scheduling email batch...'
    );

    // 1. Prepare records for database insertion
    const emailJobRecords = sanitizedRecipients.map((toEmail, index) => {
      const scheduledTime = startTimestamp + index * delayBetweenEmailsMs;
      return {
        userId,
        senderId: senderId || null,
        toEmail,
        subject,
        body,
        scheduledAt: new Date(scheduledTime),
        status: EmailJobStatus.SCHEDULED,
      };
    });

    // 2. Perform bulk insertion into PostgreSQL
    // To get the generated IDs back, we use createManyAndReturn if supported or transactional creates
    let createdJobs;
    try {
      createdJobs = await (prisma.emailJob as any).createManyAndReturn({
        data: emailJobRecords,
      });
    } catch {
      // Fallback for database providers without createManyAndReturn
      createdJobs = await prisma.$transaction(
        emailJobRecords.map((record) => prisma.emailJob.create({ data: record }))
      );
    }

    // 3. Enqueue BullMQ delayed jobs with STABLE jobId matching DB record id
    const enqueuedJobIds: string[] = [];

    // Process in chunks to prevent event loop starvation when scheduling 1,000+ jobs
    const chunkSize = 100;
    for (let i = 0; i < createdJobs.length; i += chunkSize) {
      const chunk = createdJobs.slice(i, i + chunkSize);
      await Promise.all(
        chunk.map(async (job: any) => {
          const delayMs = Math.max(0, job.scheduledAt.getTime() - Date.now());

          await addDelayedEmailJob(
            {
              jobId: job.id,
              userId: job.userId,
              senderId: job.senderId ?? undefined,
              toEmail: job.toEmail,
              subject: job.subject,
              body: job.body,
              hourlyLimit,
              minDelayMs: delayBetweenEmailsMs,
              scheduledTime: job.scheduledAt.getTime(),
            },
            delayMs
          );

          enqueuedJobIds.push(job.id);

          // Index into Elasticsearch asynchronously
          ElasticsearchService.indexEmailJob(job).catch(() => {});
        })
      );
    }

    logger.info(
      {
        totalScheduled: createdJobs.length,
        first: createdJobs[0]?.scheduledAt,
        last: createdJobs[createdJobs.length - 1]?.scheduledAt,
      },
      'Batch emails scheduled and enqueued successfully'
    );

    return {
      scheduledCount: createdJobs.length,
      batchId,
      firstScheduledAt: createdJobs[0]!.scheduledAt,
      lastScheduledAt: createdJobs[createdJobs.length - 1]!.scheduledAt,
      jobIds: enqueuedJobIds,
    };
  }
}
