import { esClient, EMAIL_JOBS_INDEX } from '../config/elasticsearch.js';
import { logger } from '../config/logger.js';
import { EmailJob } from '@prisma/client';
import { prisma } from '../db/prisma.js';

export class ElasticsearchService {
  /**
   * Index or update an email job in Elasticsearch
   */
  public static async indexEmailJob(job: EmailJob): Promise<void> {
    try {
      await esClient.index({
        index: EMAIL_JOBS_INDEX,
        id: job.id,
        document: {
          id: job.id,
          userId: job.userId,
          senderId: job.senderId,
          toEmail: job.toEmail,
          subject: job.subject,
          body: job.body,
          status: job.status,
          scheduledAt: job.scheduledAt.toISOString(),
          sentAt: job.sentAt ? job.sentAt.toISOString() : null,
          error: job.error,
          createdAt: job.createdAt.toISOString(),
        },
      });
      logger.debug({ jobId: job.id }, 'Indexed email job in Elasticsearch');
    } catch (error: any) {
      logger.warn({ error: error.message, jobId: job.id }, 'Elasticsearch indexing skipped or failed');
    }
  }

  /**
   * Search email jobs by query string across toEmail, subject, and body
   */
  public static async searchEmailJobs(
    userId: string,
    query: string,
    page = 1,
    limit = 20
  ): Promise<{ items: any[]; total: number }> {
    const from = (page - 1) * limit;

    try {
      const response = await esClient.search({
        index: EMAIL_JOBS_INDEX,
        from,
        size: limit,
        query: {
          bool: {
            must: [
              { term: { userId: userId } },
              {
                multi_match: {
                  query,
                  fields: ['toEmail^3', 'subject^2', 'body'],
                  fuzziness: 'AUTO',
                },
              },
            ],
          },
        },
        sort: [{ scheduledAt: { order: 'desc' } }],
      });

      const hits = response.hits.hits;
      const total =
        typeof response.hits.total === 'number'
          ? response.hits.total
          : response.hits.total?.value || 0;

      const items = hits.map((hit) => hit._source);
      return { items, total };
    } catch (error: any) {
      logger.warn(
        { error: error.message, query, userId },
        'Elasticsearch search failed, falling back to PostgreSQL full text / ILIKE'
      );

      // Fallback to PostgreSQL
      const [items, total] = await Promise.all([
        prisma.emailJob.findMany({
          where: {
            userId,
            OR: [
              { toEmail: { contains: query, mode: 'insensitive' } },
              { subject: { contains: query, mode: 'insensitive' } },
              { body: { contains: query, mode: 'insensitive' } },
            ],
          },
          orderBy: { scheduledAt: 'desc' },
          skip: from,
          take: limit,
        }),
        prisma.emailJob.count({
          where: {
            userId,
            OR: [
              { toEmail: { contains: query, mode: 'insensitive' } },
              { subject: { contains: query, mode: 'insensitive' } },
              { body: { contains: query, mode: 'insensitive' } },
            ],
          },
        }),
      ]);

      return { items, total };
    }
  }
}
