import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RateLimiterService } from '../src/services/rate-limiter.service.js';
import { redisClient } from '../src/config/redis.js';

describe('Phase 3: Rate Limiting & Minimum Delay', () => {
  const testSenderId = `test_sender_${Date.now()}`;
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.restoreAllMocks();

    // Mock redisClient.eval for Lua script execution
    vi.spyOn(redisClient, 'eval').mockImplementation(async (_script, _numKeys, key, limitStr, _ttlStr) => {
      const limit = parseInt(limitStr as string, 10);
      const current = parseInt(store.get(key as string) || '0', 10);

      if (current >= limit) {
        return [0, current] as any;
      }

      const next = current + 1;
      store.set(key as string, next.toString());
      return [1, next] as any;
    });

    // Mock redisClient.get
    vi.spyOn(redisClient, 'get').mockImplementation(async (key: string) => {
      return store.get(key) || null;
    });

    // Mock redisClient.set
    vi.spyOn(redisClient, 'set').mockImplementation(async (key: string, value: any) => {
      store.set(key, value.toString());
      return 'OK';
    });

    // Mock redisClient.del
    vi.spyOn(redisClient, 'del').mockImplementation(async (...keys: string[]) => {
      keys.forEach((k) => store.delete(k));
      return keys.length;
    });
  });

  it('should allow emails within the hourly limit', async () => {
    const limit = 5;

    for (let i = 1; i <= limit; i++) {
      const result = await RateLimiterService.checkHourlyLimit(testSenderId, limit);
      expect(result.allowed).toBe(true);
      expect(result.currentCount).toBe(i);
    }
  });

  it('should reject and provide retryAfterMs when hourly limit is reached without dropping jobs', async () => {
    const limit = 3;

    // Send up to limit
    for (let i = 1; i <= limit; i++) {
      await RateLimiterService.checkHourlyLimit(testSenderId, limit);
    }

    // Next attempt must be rejected and rescheduled
    const exceeded = await RateLimiterService.checkHourlyLimit(testSenderId, limit);
    expect(exceeded.allowed).toBe(false);
    expect(exceeded.currentCount).toBe(limit);
    expect(exceeded.retryAfterMs).toBeDefined();
    expect(exceeded.retryAfterMs).toBeGreaterThan(0);
    expect(exceeded.nextWindowDate).toBeInstanceOf(Date);
  });

  it('should track minimum delay timestamps accurately', async () => {
    await RateLimiterService.recordSend(testSenderId);
    const key = `rate:last_send:${testSenderId}`;
    const stored = await redisClient.get(key);

    expect(stored).toBeDefined();
    expect(parseInt(stored!, 10)).toBeLessThanOrEqual(Date.now());
  });

  it('should handle high load: 1,000 rapid check operations with atomic count consistency', async () => {
    const highLoadSender = `sender_load_${Date.now()}`;
    const limit = 500;

    const promises = Array.from({ length: 1000 }, () =>
      RateLimiterService.checkHourlyLimit(highLoadSender, limit)
    );

    const results = await Promise.all(promises);
    const allowedCount = results.filter((r) => r.allowed).length;
    const rejectedCount = results.filter((r) => !r.allowed).length;

    expect(allowedCount).toBe(limit);
    expect(rejectedCount).toBe(500);
  });
});
