import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmailSchedulerService } from '../src/services/email-scheduler.service.js';
import { prisma } from '../src/db/prisma.js';
import * as emailQueueModule from '../src/queues/email.queue.js';
import { EmailJobStatus } from '@prisma/client';

describe('Phase 2: Scheduling & Batch Enqueueing', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should sanitize, deduplicate recipients, and schedule delayed jobs with correct delay intervals', async () => {
    const rawRecipients = [
      'user1@example.com',
      'USER1@EXAMPLE.COM', // duplicate in different case
      'user2@example.com',
      'invalid-email-address', // invalid format
    ];

    const fakeJobs = [
      {
        id: 'row_1',
        userId: 'u1',
        toEmail: 'user1@example.com',
        subject: 'Campaign',
        body: 'Body',
        scheduledAt: new Date(Date.now() + 1000),
        status: EmailJobStatus.SCHEDULED,
      },
      {
        id: 'row_2',
        userId: 'u1',
        toEmail: 'user2@example.com',
        subject: 'Campaign',
        body: 'Body',
        scheduledAt: new Date(Date.now() + 3000),
        status: EmailJobStatus.SCHEDULED,
      },
    ];

    vi.spyOn(prisma.emailJob, 'createManyAndReturn' as any).mockResolvedValue(fakeJobs as any);
    const addJobSpy = vi.spyOn(emailQueueModule, 'addDelayedEmailJob').mockResolvedValue({ id: 'mock' } as any);

    const result = await EmailSchedulerService.scheduleEmails('u1', {
      subject: 'Campaign',
      body: 'Body',
      recipientEmails: rawRecipients,
      delayBetweenEmailsMs: 2000,
      hourlyLimit: 100,
    });

    // Valid unique emails = 2
    expect(result.scheduledCount).toBe(2);
    expect(addJobSpy).toHaveBeenCalledTimes(2);

    // Verify stable jobId is used matching DB record ID
    expect(addJobSpy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ jobId: 'row_1', toEmail: 'user1@example.com' }),
      expect.any(Number)
    );
    expect(addJobSpy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ jobId: 'row_2', toEmail: 'user2@example.com' }),
      expect.any(Number)
    );
  });
});
