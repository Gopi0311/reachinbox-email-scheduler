import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReconciliationService } from '../src/services/reconciliation.service.js';
import { prisma } from '../src/db/prisma.js';
import * as emailQueueModule from '../src/queues/email.queue.js';
import { EmailJobStatus } from '@prisma/client';

describe('Phase 2 & Hard Constraint: Durable Restart Recovery', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should recover jobs stuck in PROCESSING state after sudden server crash', async () => {
    const stuckJobs = [
      { id: 'stuck_1', status: EmailJobStatus.PROCESSING },
      { id: 'stuck_2', status: EmailJobStatus.PROCESSING },
    ];

    vi.spyOn(prisma.emailJob, 'findMany')
      .mockResolvedValueOnce(stuckJobs as any) // stuck in processing
      .mockResolvedValueOnce([] as any); // pending jobs

    const updateSpy = vi.spyOn(prisma.emailJob, 'update').mockResolvedValue({} as any);

    const report = await ReconciliationService.reconcile();

    expect(report.recoveredProcessingCount).toBe(2);
    expect(updateSpy).toHaveBeenCalledTimes(2);
    expect(updateSpy).toHaveBeenCalledWith({
      where: { id: 'stuck_1' },
      data: { status: EmailJobStatus.SCHEDULED },
    });
  });

  it('should re-enqueue pending jobs that are missing from BullMQ', async () => {
    const pendingJobs = [
      {
        id: 'pending_1',
        userId: 'u1',
        toEmail: 'requeued@reachinbox.ai',
        subject: 'Durable Test',
        body: 'Recovery body',
        scheduledAt: new Date(Date.now() + 60000),
        status: EmailJobStatus.SCHEDULED,
        sender: { hourlyLimit: 100, minDelayMs: 2000 },
      },
    ];

    vi.spyOn(prisma.emailJob, 'findMany')
      .mockResolvedValueOnce([]) // no stuck jobs
      .mockResolvedValueOnce(pendingJobs as any); // 1 pending job

    // Mock BullMQ: job does not exist in queue
    vi.spyOn(emailQueueModule, 'getBullMQJob').mockResolvedValue(undefined);
    const addJobSpy = vi.spyOn(emailQueueModule, 'addDelayedEmailJob').mockResolvedValue({ id: 'pending_1' } as any);

    const report = await ReconciliationService.reconcile();

    expect(report.requeuedScheduledCount).toBe(1);
    expect(addJobSpy).toHaveBeenCalledTimes(1);
    expect(addJobSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: 'pending_1',
        toEmail: 'requeued@reachinbox.ai',
      }),
      expect.any(Number)
    );
  });
});
