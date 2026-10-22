import { createEmailWorker } from './email.worker.js';
import { logger } from '../config/logger.js';
import { prisma } from '../db/prisma.js';
import { initElasticsearch } from '../config/elasticsearch.js';

const startWorkerProcess = async () => {
  logger.info('Starting standalone Email Scheduler Worker process...');

  try {
    // Check Elasticsearch connection
    await initElasticsearch();

    const worker = createEmailWorker();

    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received. Closing BullMQ worker...`);
      await worker.close();
      await prisma.$disconnect();
      logger.info('BullMQ worker closed cleanly');
      process.exit(0);
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  } catch (error) {
    logger.fatal({ error }, 'Fatal error starting Email Scheduler Worker');
    process.exit(1);
  }
};

startWorkerProcess();
