import { Client } from '@elastic/elasticsearch';
import { env } from './env.js';
import { logger } from './logger.js';

export const esClient = new Client({
  node: env.ELASTICSEARCH_URL,
  maxRetries: 3,
  requestTimeout: 5000,
});

export const EMAIL_JOBS_INDEX = 'email_jobs';

export const initElasticsearch = async (): Promise<boolean> => {
  try {
    const health = await esClient.cluster.health();
    logger.info({ status: health.status }, 'Elasticsearch connected successfully');

    const indexExists = await esClient.indices.exists({ index: EMAIL_JOBS_INDEX });
    if (!indexExists) {
      await esClient.indices.create({
        index: EMAIL_JOBS_INDEX,
        mappings: {
          properties: {
            id: { type: 'keyword' },
            userId: { type: 'keyword' },
            senderId: { type: 'keyword' },
            toEmail: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            subject: { type: 'text' },
            body: { type: 'text' },
            status: { type: 'keyword' },
            scheduledAt: { type: 'date' },
            sentAt: { type: 'date' },
            error: { type: 'text' },
            createdAt: { type: 'date' },
          },
        },
      });
      logger.info(`Elasticsearch index '${EMAIL_JOBS_INDEX}' created`);
    }

    return true;
  } catch (error: any) {
    logger.warn({ error: error.message }, 'Elasticsearch is not reachable. Search features will be disabled or fallback to DB.');
    return false;
  }
};
