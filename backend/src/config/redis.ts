import { Redis, RedisOptions } from 'ioredis';
import { env } from './env.js';
import { logger } from './logger.js';

export const redisOptions: RedisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy(times) {
    const delay = Math.min(times * 100, 3000);
    return delay;
  },
};

export const redisClient = new Redis(env.REDIS_URL, redisOptions);

redisClient.on('connect', () => {
  logger.info('Connected to Redis');
});

redisClient.on('error', (err) => {
  logger.error({ err }, 'Redis connection error');
});

export const createRedisConnection = () => {
  return new Redis(env.REDIS_URL, redisOptions);
};
