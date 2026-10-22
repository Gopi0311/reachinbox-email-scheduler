import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DelayedError } from 'bullmq';
import { processEmailJob } from '../src/workers/email.worker.js';
import { prisma } from '../src/db/prisma.js';
import { RateLimiterService } from '../src/services/rate-limiter.service.js';
import { SlackService } from '../src/services/slack.service.js';
import * as emailConfig from '../src/config/email.js';
import { ElasticsearchService } from '../src/services/elasticsearch.service.js';
import { EmailJobStatus } from '@prisma/client';
import { EmailJobData } from '../src/types/index.js';

describe('Hourly Rate Limiting: 5 jobs with hourlyLimit 2', () => {
  const senderId = 'sender_test_hourly_123';
  const userId = 'user_test_123';

  // In-memory representation of database records
  interface MockDbRecord {
    id: string;
    userId: string;
    senderId: string;
    toEmail: string;
    subject: string;
    body: string;
    scheduledAt: Date;
    status: EmailJobStatus;
    attempts: number;
    sentAt: Date | null;
    error: string | null;
    user: any;
    sender: any;
  }

  let dbJobs: Map<string, MockDbRecord>;
  let sendMailMock: any;

  beforeEach(() => {
    vi.restoreAllMocks();

    dbJobs = new Map<string, MockDbRecord>();

    for (let i = 1; i <= 5; i++) {
      const id = `job_${i}`;
      dbJobs.set(id, {
        id,
        userId,
        senderId,
        toEmail: `lead${i}@enterprise.com`,
        subject: `Outreach ${i}`,
        body: `Hello ${i}`,
        scheduledAt: new Date(Date.now() + (i - 1) * 2000),
        status: EmailJobStatus.SCHEDULED,
        attempts: 0,
        sentAt: null,
        error: null,
        user: { id: userId, email: 'sender@reachinbox.ai', name: 'ReachInbox Sender' },
        sender: { id: senderId, email: 'sender@reachinbox.ai', hourlyLimit: 2, minDelayMs: 2000 },
      });
    }

    // Mock prisma.emailJob
    vi.spyOn(prisma.emailJob, 'findUnique').mockImplementation(async ({ where }: any) => {
      return (dbJobs.get(where.id) as any) ?? null;
    });

    vi.spyOn(prisma.emailJob, 'updateMany').mockImplementation(async ({ where, data }: any) => {
      const record = dbJobs.get(where.id);
      if (!record) return { count: 0 };

      const allowedStatuses = where.status?.in || [where.status];
      if (!allowedStatuses.includes(record.status)) {
        return { count: 0 };
      }

      if (data.status) record.status = data.status;
      if (data.attempts?.increment) record.attempts += data.attempts.increment;
      return { count: 1 };
    });

    vi.spyOn(prisma.emailJob, 'update').mockImplementation(async ({ where, data }: any) => {
      const record = dbJobs.get(where.id);
      if (!record) throw new Error(`Record ${where.id} not found`);

      if (data.status) record.status = data.status;
      if (data.scheduledAt) record.scheduledAt = data.scheduledAt;
      if (data.sentAt) record.sentAt = data.sentAt;
      if ('error' in data) record.error = data.error;

      return record as any;
    });

    // Mock transporter
    sendMailMock = vi.fn().mockResolvedValue({
      messageId: '<test-delivered@ethereal.email>',
    });
    vi.spyOn(emailConfig, 'getEmailTransporter').mockResolvedValue({
      sendMail: sendMailMock,
    } as any);

    // Mock Elasticsearch
    vi.spyOn(ElasticsearchService, 'indexEmailJob').mockResolvedValue(undefined as any);

    // Mock enforceMinDelay and recordSend so test runs fast
    vi.spyOn(RateLimiterService, 'enforceMinDelay').mockResolvedValue(0);
    vi.spyOn(RateLimiterService, 'recordSend').mockResolvedValue(undefined);
  });

  it('proves: 5 jobs with hourlyLimit 2 results in 2 sent and 3 delayed jobs in the queue, and later all get sent', async () => {
    // Current simulation hour: window 1
    let simulatedHour = 1;
    let windowSentCount = 0;
    const hourlyLimit = 2;

    // Mock checkHourlyLimit based on hourlyLimit = 2 per hour window
    vi.spyOn(RateLimiterService, 'checkHourlyLimit').mockImplementation(async () => {
      if (windowSentCount < hourlyLimit) {
        windowSentCount++;
        return {
          allowed: true,
          currentCount: windowSentCount,
          limit: hourlyLimit,
        };
      }
      return {
        allowed: false,
        currentCount: windowSentCount,
        limit: hourlyLimit,
        retryAfterMs: 3600000,
        nextWindowDate: new Date(Date.now() + 3600000),
      };
    });

    // Mock Slack rate-limit notification to verify once-per-sender alerting
    const slackSpy = vi.spyOn(SlackService, 'notifyRateLimitExceeded').mockResolvedValue(true);

    // Track moveToDelayed calls
    let rescheduleCounter = 0;
    vi.spyOn(RateLimiterService, 'calculateNextWindowTimestamp').mockImplementation(async () => {
      rescheduleCounter++;
      const nextWindowBase = 1700000000000 + simulatedHour * 3600000;
      // Adds small per-job offset preserving original order: (rescheduleCounter - 1) * 2000
      return nextWindowBase + (rescheduleCounter - 1) * 2000;
    });

    // Helper to build BullMQ job mock
    const createMockBullJob = (id: string) => {
      const dbRecord = dbJobs.get(id)!;
      const jobData: EmailJobData = {
        jobId: id,
        userId,
        senderId,
        toEmail: dbRecord.toEmail,
        subject: dbRecord.subject,
        body: dbRecord.body,
        hourlyLimit,
        minDelayMs: 2000,
        scheduledTime: dbRecord.scheduledAt.getTime(),
      };

      const moveToDelayed = vi.fn().mockResolvedValue(undefined);

      return {
        id,
        data: jobData,
        moveToDelayed,
      };
    };

    const bullJobs = [
      createMockBullJob('job_1'),
      createMockBullJob('job_2'),
      createMockBullJob('job_3'),
      createMockBullJob('job_4'),
      createMockBullJob('job_5'),
    ];

    // =========================================================================
    // WINDOW 1: Process all 5 jobs with hourlyLimit = 2
    // =========================================================================

    // Job 1 -> within limit (1/2) -> SENT
    const res1 = await processEmailJob(bullJobs[0] as any, 'token_1');
    expect(res1.status).toBe('sent');
    expect(dbJobs.get('job_1')?.status).toBe(EmailJobStatus.SENT);
    expect(bullJobs[0].moveToDelayed).not.toHaveBeenCalled();

    // Job 2 -> within limit (2/2) -> SENT
    const res2 = await processEmailJob(bullJobs[1] as any, 'token_2');
    expect(res2.status).toBe('sent');
    expect(dbJobs.get('job_2')?.status).toBe(EmailJobStatus.SENT);
    expect(bullJobs[1].moveToDelayed).not.toHaveBeenCalled();

    // Job 3 -> limit reached (2 >= 2) -> Moved to delayed set & throws DelayedError!
    await expect(processEmailJob(bullJobs[2] as any, 'token_3')).rejects.toThrow(DelayedError);
    expect(bullJobs[2].moveToDelayed).toHaveBeenCalledTimes(1);
    expect(dbJobs.get('job_3')?.status).toBe(EmailJobStatus.RESCHEDULED);
    expect(dbJobs.get('job_3')?.status).not.toBe(EmailJobStatus.FAILED);

    // Job 4 -> limit reached -> Moved to delayed set & throws DelayedError!
    await expect(processEmailJob(bullJobs[3] as any, 'token_4')).rejects.toThrow(DelayedError);
    expect(bullJobs[3].moveToDelayed).toHaveBeenCalledTimes(1);
    expect(dbJobs.get('job_4')?.status).toBe(EmailJobStatus.RESCHEDULED);
    expect(dbJobs.get('job_4')?.status).not.toBe(EmailJobStatus.FAILED);

    // Job 5 -> limit reached -> Moved to delayed set & throws DelayedError!
    await expect(processEmailJob(bullJobs[4] as any, 'token_5')).rejects.toThrow(DelayedError);
    expect(bullJobs[4].moveToDelayed).toHaveBeenCalledTimes(1);
    expect(dbJobs.get('job_5')?.status).toBe(EmailJobStatus.RESCHEDULED);
    expect(dbJobs.get('job_5')?.status).not.toBe(EmailJobStatus.FAILED);

    // Verify ordering preservation via per-job offsets:
    const delayTs3 = bullJobs[2].moveToDelayed.mock.calls[0][0];
    const delayTs4 = bullJobs[3].moveToDelayed.mock.calls[0][0];
    const delayTs5 = bullJobs[4].moveToDelayed.mock.calls[0][0];
    expect(delayTs3).toBeLessThan(delayTs4);
    expect(delayTs4).toBeLessThan(delayTs5);

    // Verify interim state: Exactly 2 SENT and 3 DELAYED in queue
    const sentCountPhase1 = Array.from(dbJobs.values()).filter(
      (j) => j.status === EmailJobStatus.SENT
    ).length;
    const delayedCountPhase1 = Array.from(dbJobs.values()).filter(
      (j) => j.status === EmailJobStatus.RESCHEDULED
    ).length;
    const failedCountPhase1 = Array.from(dbJobs.values()).filter(
      (j) => j.status === EmailJobStatus.FAILED
    ).length;

    expect(sentCountPhase1).toBe(2);
    expect(delayedCountPhase1).toBe(3);
    expect(failedCountPhase1).toBe(0);
    expect(sendMailMock).toHaveBeenCalledTimes(2);

    // =========================================================================
    // WINDOW 2: Next hour begins. Window resets (2 more allowed)
    // =========================================================================
    simulatedHour = 2;
    windowSentCount = 0; // New hour window quota
    rescheduleCounter = 0;

    // Job 3 wakes up from delayed queue -> processed in window 2 (1/2) -> SENT
    const res3 = await processEmailJob(bullJobs[2] as any, 'token_3_retry');
    expect(res3.status).toBe('sent');
    expect(dbJobs.get('job_3')?.status).toBe(EmailJobStatus.SENT);

    // Job 4 wakes up from delayed queue -> processed in window 2 (2/2) -> SENT
    const res4 = await processEmailJob(bullJobs[3] as any, 'token_4_retry');
    expect(res4.status).toBe('sent');
    expect(dbJobs.get('job_4')?.status).toBe(EmailJobStatus.SENT);

    // Job 5 wakes up from delayed queue -> limit reached in window 2 (2 >= 2) -> delayed to window 3!
    await expect(processEmailJob(bullJobs[4] as any, 'token_5_retry')).rejects.toThrow(DelayedError);
    expect(bullJobs[4].moveToDelayed).toHaveBeenCalledTimes(2); // Called again for window 3
    expect(dbJobs.get('job_5')?.status).toBe(EmailJobStatus.RESCHEDULED);

    expect(
      Array.from(dbJobs.values()).filter((j) => j.status === EmailJobStatus.SENT).length
    ).toBe(4);

    // =========================================================================
    // WINDOW 3: Third hour begins. Remaining job 5 executes -> SENT
    // =========================================================================
    simulatedHour = 3;
    windowSentCount = 0; // New hour window quota

    const res5 = await processEmailJob(bullJobs[4] as any, 'token_5_final');
    expect(res5.status).toBe('sent');
    expect(dbJobs.get('job_5')?.status).toBe(EmailJobStatus.SENT);

    // =========================================================================
    // FINAL ASSERTION: All 5 jobs were sent, 0 dropped, 0 permanently rate-limited
    // =========================================================================
    const finalSentJobs = Array.from(dbJobs.values()).filter(
      (j) => j.status === EmailJobStatus.SENT
    );
    const finalFailedJobs = Array.from(dbJobs.values()).filter(
      (j) => j.status === EmailJobStatus.FAILED
    );
    const finalRescheduledJobs = Array.from(dbJobs.values()).filter(
      (j) => j.status === EmailJobStatus.RESCHEDULED
    );

    expect(finalSentJobs.length).toBe(5);
    expect(finalFailedJobs.length).toBe(0);
    expect(finalRescheduledJobs.length).toBe(0);
    expect(sendMailMock).toHaveBeenCalledTimes(5);
  });

  it('proves: Slack rate-limit alert is throttled to once per sender per hour window', async () => {
    const redisStore = new Map<string, string>();
    const redisModule = await import('../src/config/redis.js');

    vi.spyOn(redisModule.redisClient, 'set').mockImplementation(async (key: string, value: any, ...args: any[]) => {
      // Handle NX flag
      if (args.includes('NX')) {
        if (redisStore.has(key)) {
          return null;
        }
        redisStore.set(key, String(value));
        return 'OK';
      }
      redisStore.set(key, String(value));
      return 'OK';
    });

    // Mock prisma slackConnection
    vi.spyOn(prisma.slackConnection, 'findFirst').mockResolvedValue({
      id: 'sc_1',
      userId,
      incomingWebhookUrl: 'https://hooks.slack.com/services/mock',
    } as any);

    // Mock global fetch for Slack webhook
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    globalThis.fetch = fetchSpy as any;

    const alertData = {
      userId,
      senderId,
      senderEmail: 'sender@reachinbox.ai',
      limit: 2,
      currentCount: 2,
      nextWindowDate: new Date(Date.now() + 3600000),
    };

    // First job hits limit -> alert is sent
    const alert1 = await SlackService.notifyRateLimitExceeded(alertData);
    expect(alert1).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Second job hits limit in the SAME hour -> throttled (not sent!)
    const alert2 = await SlackService.notifyRateLimitExceeded(alertData);
    expect(alert2).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Third job hits limit in the SAME hour -> throttled (not sent!)
    const alert3 = await SlackService.notifyRateLimitExceeded(alertData);
    expect(alert3).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
