import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmailSenderService } from '../src/services/email-sender.service.js';
import { prisma } from '../src/db/prisma.js';
import { EmailJobStatus } from '@prisma/client';

describe('Phase 2 & Hard Constraint: Idempotency & Concurrency', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should allow only one concurrent worker to claim a scheduled job', async () => {
    const fakeJobId = 'job_12345';
    let isClaimed = false;

    // Mock prisma to simulate atomic database lock
    vi.spyOn(prisma.emailJob, 'findUnique').mockImplementation(async (args: any) => {
      return {
        id: fakeJobId,
        userId: 'user_1',
        senderId: null,
        toEmail: 'test@example.com',
        subject: 'Hello',
        body: 'World',
        scheduledAt: new Date(),
        status: isClaimed ? EmailJobStatus.PROCESSING : EmailJobStatus.SCHEDULED,
        sentAt: null,
        error: null,
        attempts: isClaimed ? 1 : 0,
        bullJobId: fakeJobId,
        messageId: null,
        previewUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        sender: null,
        user: {
          id: 'user_1',
          googleId: 'g_1',
          email: 'sender@example.com',
          name: 'Sender',
          avatar: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      } as any;
    });

    vi.spyOn(prisma.emailJob, 'updateMany').mockImplementation(async (args: any) => {
      if (!isClaimed) {
        isClaimed = true;
        return { count: 1 };
      }
      return { count: 0 };
    });

    // Simulate 5 simultaneous worker processes attempting to claim the exact same job ID
    const workerAttempts = await Promise.all([
      EmailSenderService.claimJob(fakeJobId),
      EmailSenderService.claimJob(fakeJobId),
      EmailSenderService.claimJob(fakeJobId),
      EmailSenderService.claimJob(fakeJobId),
      EmailSenderService.claimJob(fakeJobId),
    ]);

    const successfulClaims = workerAttempts.filter((res) => res !== null);
    const rejectedClaims = workerAttempts.filter((res) => res === null);

    // EXACTLY 1 worker successfully claims the job
    expect(successfulClaims.length).toBe(1);
    // All other 4 workers are safely rejected
    expect(rejectedClaims.length).toBe(4);
  });

  it('should never claim a job that has already transitioned to SENT', async () => {
    const sentJobId = 'job_already_sent';

    vi.spyOn(prisma.emailJob, 'findUnique').mockResolvedValue({
      id: sentJobId,
      status: EmailJobStatus.SENT,
    } as any);

    const claim = await EmailSenderService.claimJob(sentJobId);
    expect(claim).toBeNull();
  });
});
