import type { Redis } from "ioredis";
import { logger } from "../config/logger.js";

/**
 * Tag-based Redis cache for hot public API responses.
 * `cached(key, tags, ttl, fn)`; `invalidateTags(tags)` removes every key registered under a tag.
 */
export class Cache {
  constructor(private readonly redis: Redis, private readonly prefix = "c:") {}

  async cached<T>(key: string, tags: string[], ttlSec: number, fn: () => Promise<T>): Promise<T> {
    const k = this.prefix + key;
    try {
      const hit = await this.redis.get(k);
      if (hit !== null) return JSON.parse(hit) as T;
    } catch (err) {
      logger.warn({ err }, "cache read failed");
    }
    const value = await fn();
    try {
      const multi = this.redis.multi().set(k, JSON.stringify(value), "EX", ttlSec);
      for (const t of tags) multi.sadd(`ctag:${t}`, k).expire(`ctag:${t}`, 86_400);
      await multi.exec();
    } catch (err) {
      logger.warn({ err }, "cache write failed");
    }
    return value;
  }

  async invalidateTags(tags: string[]): Promise<void> {
    for (const t of tags) {
      const keys = await this.redis.smembers(`ctag:${t}`);
      if (keys.length) await this.redis.del(...keys);
      await this.redis.del(`ctag:${t}`);
    }
  }
}
