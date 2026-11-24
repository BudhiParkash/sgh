import type { Request, RequestHandler } from "express";
import type { Redis } from "ioredis";
import { RateLimiterMemory, RateLimiterRedis, type RateLimiterRes } from "rate-limiter-flexible";
import { tooMany } from "../lib/errors.js";

export interface LimiterSpec {
  name: string;
  points: number;
  durationSec: number;
  /** Optional block once exhausted (seconds). */
  blockSec?: number;
  key?: (req: Request) => string;
}

export function createLimiter(redis: Redis, spec: LimiterSpec): RateLimiterRedis {
  return new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: `rl:${spec.name}`,
    points: spec.points,
    duration: spec.durationSec,
    blockDuration: spec.blockSec ?? 0,
    // If Redis is down, fall back to per-process memory limits rather than failing open.
    insuranceLimiter: new RateLimiterMemory({ points: spec.points, duration: spec.durationSec }),
  });
}

/** Express middleware: consumes 1 point per request keyed by hashed IP (or custom key). */
export function rateLimit(redis: Redis, spec: LimiterSpec): RequestHandler {
  const limiter = createLimiter(redis, spec);
  return async (req, res, next) => {
    try {
      const r = await limiter.consume(spec.key ? spec.key(req) : req.ipHash);
      res.setHeader("RateLimit-Remaining", String(r.remainingPoints));
      next();
    } catch (e) {
      if (e instanceof Error) return next(e);
      next(tooMany((e as RateLimiterRes).msBeforeNext / 1000));
    }
  };
}
