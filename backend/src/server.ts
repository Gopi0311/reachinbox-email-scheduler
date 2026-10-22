import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { prisma } from './db/prisma.js';
import { initElasticsearch } from './config/elasticsearch.js';
import { ReconciliationService } from './services/reconciliation.service.js';
import { createEmailWorker } from './workers/email.worker.js';

const startServer = async () => {
  try {
    logger.info('Starting ReachInbox Scheduler backend server...');

    // Initialize Elasticsearch index
    await initElasticsearch();

    // Reconcile pending jobs and recover stuck jobs
    await ReconciliationService.reconcile();

    // In dev mode, run an embedded worker instance unless STANDALONE_WORKER=true
    let worker: ReturnType<typeof createEmailWorker> | undefined;
    if (process.env.STANDALONE_WORKER !== 'true') {
      worker = createEmailWorker(env.WORKER_CONCURRENCY);
    }

    const app = createApp();

    const server = app.listen(env.PORT, () => {
      logger.info(`Server running on http://localhost:${env.PORT} in ${env.NODE_ENV} mode`);
      logger.info(`Queue monitoring available at http://localhost:${env.PORT}/admin/queues`);
    });

    const shutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully...`);
      if (worker) {
        await worker.close();
      }
      server.close(async () => {
        logger.info('HTTP server closed');
        try {
          await prisma.$disconnect();
          logger.info('Prisma disconnected');
        } catch (e) {
          // ignore
        }
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    logger.fatal({ error }, 'Failed to start server');
    process.exit(1);
  }
};

startServer();
