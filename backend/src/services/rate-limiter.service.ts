import { redisClient } from '../config/redis.js';
import { logger } from '../config/logger.js';

export interface RateLimitCheckResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  retryAfterMs?: number;
  nextWindowDate?: Date;
}

const CHECK_AND_INCREMENT_LUA = `
  local key = KEYS[1]
  local limit = tonumber(ARGV[1])
  local ttl = tonumber(ARGV[2])

  local current = tonumber(redis.call('get', key) or "0")
  if current >= limit then
    return {0, current}
  end

  current = redis.call('incr', key)
  if current == 1 then
    redis.call('expire', key, ttl)
  end

  return {1, current}
`;

export class RateLimiterService {
  /**
   * Check and increment the hourly limit counter for a sender atomically.
   */
  public static async checkHourlyLimit(
    senderId: string,
    limit: number
  ): Promise<RateLimitCheckResult> {
    const now = Date.now();
    const currentHourWindow = Math.floor(now / 3600000) * 3600000;
    const nextHourWindow = currentHourWindow + 3600000;
    const retryAfterMs = Math.max(1000, nextHourWindow - now + 500); // 500ms safety buffer
    const key = `rate:hourly:${senderId}:${currentHourWindow}`;
    const ttlSeconds = 7200; // 2 hours TTL

    try {
      const result = (await redisClient.eval(
        CHECK_AND_INCREMENT_LUA,
        1,
        key,
        limit.toString(),
        ttlSeconds.toString()
      )) as [number, number];

      const allowed = result[0] === 1;
      const currentCount = result[1];

      if (!allowed) {
        logger.warn(
          {
            senderId,
            currentCount,
            limit,
            retryAfterMs,
            nextWindowDate: new Date(nextHourWindow).toISOString(),
          },
          'Hourly rate limit hit for sender'
        );

        return {
          allowed: false,
          currentCount,
          limit,
          retryAfterMs,
          nextWindowDate: new Date(nextHourWindow),
        };
      }

      return {
        allowed: true,
        currentCount,
        limit,
      };
    } catch (error) {
      logger.error({ error, senderId }, 'Failed to evaluate rate limit script in Redis');
      // If Redis eval fails temporarily, allow processing to avoid stuck queue
      return {
        allowed: true,
        currentCount: 1,
        limit,
      };
    }
  }

  /**
   * Enforce minimum delay between emails for a sender.
   * If not enough time has elapsed since the last email, sleeps the remaining duration.
   */
  public static async enforceMinDelay(
    senderId: string,
    minDelayMs: number
  ): Promise<number> {
    if (minDelayMs <= 0) return 0;

    const key = `rate:last_send:${senderId}`;
    try {
      const lastSendStr = await redisClient.get(key);
      if (lastSendStr) {
        const lastSend = parseInt(lastSendStr, 10);
        const elapsed = Date.now() - lastSend;
        if (elapsed < minDelayMs) {
          const waitTime = minDelayMs - elapsed;
          logger.debug({ senderId, waitTime }, 'Enforcing minimum delay between emails');
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          return waitTime;
        }
      }
    } catch (error) {
      logger.warn({ error, senderId }, 'Error checking last send timestamp');
    }

    return 0;
  }

  /**
   * Record that an email has been sent by this sender right now.
   */
  public static async recordSend(senderId: string): Promise<void> {
    const key = `rate:last_send:${senderId}`;
    try {
      await redisClient.set(key, Date.now().toString(), 'EX', 86400);
    } catch (error) {
      logger.warn({ error, senderId }, 'Failed to record last send timestamp');
    }
  }

  /**
   * Get current hourly usage for a sender
   */
  public static async getCurrentHourlyUsage(senderId: string): Promise<number> {
    const now = Date.now();
    const currentHourWindow = Math.floor(now / 3600000) * 3600000;
    const key = `rate:hourly:${senderId}:${currentHourWindow}`;
    const count = await redisClient.get(key);
    return count ? parseInt(count, 10) : 0;
  }

  /**
   * Reset rate limit counters for testing
   */
  public static async resetSenderRateLimit(senderId: string): Promise<void> {
    const now = Date.now();
    const currentHourWindow = Math.floor(now / 3600000) * 3600000;
    const key = `rate:hourly:${senderId}:${currentHourWindow}`;
    const lastSendKey = `rate:last_send:${senderId}`;
    await redisClient.del(key, lastSendKey);
  }
}
