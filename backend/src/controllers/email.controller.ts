import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { EmailSchedulerService } from '../services/email-scheduler.service.js';
import { ElasticsearchService } from '../services/elasticsearch.service.js';
import { removeBullMQJob } from '../queues/email.queue.js';
import { RateLimiterService } from '../services/rate-limiter.service.js';
import { NotFoundError, BadRequestError } from '../middleware/error.js';
import { EmailJobStatus } from '@prisma/client';
import { env } from '../config/env.js';

export class EmailController {
  /**
   * POST /api/emails/schedule
   */
  public static async schedule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const {
        subject,
        body,
        recipientEmails,
        startTime,
        delayBetweenEmailsMs,
        hourlyLimit,
        senderId,
      } = req.body;

      if (!recipientEmails || !Array.isArray(recipientEmails) || recipientEmails.length === 0) {
        throw new BadRequestError('Recipient emails array is required');
      }

      if (!subject || !body) {
        throw new BadRequestError('Subject and body are required');
      }

      const result = await EmailSchedulerService.scheduleEmails(userId, {
        subject,
        body,
        recipientEmails,
        startTime: startTime ? new Date(startTime) : new Date(),
        delayBetweenEmailsMs: delayBetweenEmailsMs ? Number(delayBetweenEmailsMs) : env.MIN_EMAIL_DELAY_MS,
        hourlyLimit: hourlyLimit ? Number(hourlyLimit) : env.MAX_EMAILS_PER_HOUR,
        senderId,
      });

      res.status(201).json({
        success: true,
        data: result,
        message: `Successfully scheduled ${result.scheduledCount} emails`,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/emails/scheduled
   */
  public static async getScheduled(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
      const skip = (page - 1) * limit;

      const [items, total] = await Promise.all([
        prisma.emailJob.findMany({
          where: {
            userId,
            status: { in: [EmailJobStatus.SCHEDULED, EmailJobStatus.PROCESSING, EmailJobStatus.RESCHEDULED] },
          },
          orderBy: { scheduledAt: 'asc' },
          skip,
          take: limit,
          include: { sender: true },
        }),
        prisma.emailJob.count({
          where: {
            userId,
            status: { in: [EmailJobStatus.SCHEDULED, EmailJobStatus.PROCESSING, EmailJobStatus.RESCHEDULED] },
          },
        }),
      ]);

      res.status(200).json({
        success: true,
        data: {
          items,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/emails/sent
   */
  public static async getSent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
      const skip = (page - 1) * limit;

      const [items, total] = await Promise.all([
        prisma.emailJob.findMany({
          where: {
            userId,
            status: { in: [EmailJobStatus.SENT, EmailJobStatus.FAILED] },
          },
          orderBy: { sentAt: 'desc' },
          skip,
          take: limit,
          include: { sender: true },
        }),
        prisma.emailJob.count({
          where: {
            userId,
            status: { in: [EmailJobStatus.SENT, EmailJobStatus.FAILED] },
          },
        }),
      ]);

      res.status(200).json({
        success: true,
        data: {
          items,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/emails/search?q=
   */
  public static async search(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const query = (req.query.q as string) || '';
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 10));

      if (!query.trim()) {
        res.status(200).json({
          success: true,
          data: { items: [], total: 0, page, limit, totalPages: 0 },
        });
        return;
      }

      const { items, total } = await ElasticsearchService.searchEmailJobs(
        userId,
        query.trim(),
        page,
        limit
      );

      res.status(200).json({
        success: true,
        data: {
          items,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/emails/:id
   */
  public static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const job = await prisma.emailJob.findFirst({
        where: { id, userId },
        include: { sender: true },
      });

      if (!job) {
        throw new NotFoundError('Email job not found');
      }

      res.status(200).json({
        success: true,
        data: job,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/emails/:id (Cancel scheduled email)
   */
  public static async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const job = await prisma.emailJob.findFirst({
        where: { id, userId },
      });

      if (!job) {
        throw new NotFoundError('Email job not found');
      }

      if (job.status === EmailJobStatus.SENT) {
        throw new BadRequestError('Cannot cancel an email that has already been sent');
      }

      // Remove from BullMQ
      await removeBullMQJob(job.id);

      // Delete from DB
      await prisma.emailJob.delete({
        where: { id: job.id },
      });

      res.status(200).json({
        success: true,
        message: 'Email job cancelled and removed successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/emails/stats
   */
  public static async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;

      const [scheduledCount, sentCount, failedCount, hourlyUsage] = await Promise.all([
        prisma.emailJob.count({
          where: {
            userId,
            status: { in: [EmailJobStatus.SCHEDULED, EmailJobStatus.PROCESSING, EmailJobStatus.RESCHEDULED] },
          },
        }),
        prisma.emailJob.count({
          where: { userId, status: EmailJobStatus.SENT },
        }),
        prisma.emailJob.count({
          where: { userId, status: EmailJobStatus.FAILED },
        }),
        RateLimiterService.getCurrentHourlyUsage(userId),
      ]);

      res.status(200).json({
        success: true,
        data: {
          scheduledCount,
          sentCount,
          failedCount,
          currentHourSent: hourlyUsage,
          hourlyLimit: env.MAX_EMAILS_PER_HOUR,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
