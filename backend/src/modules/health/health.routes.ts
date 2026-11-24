import { Router } from "express";
import mongoose from "mongoose";
import type { Redis } from "ioredis";
import { ok } from "../../lib/respond.js";

const VERSION = process.env.APP_VERSION ?? "dev";

/** Public health: minimal info. Dependency status is included only as a boolean summary. */
export function healthRoutes(redis: Redis): Router {
  const r = Router();
  r.get("/", async (_req, res) => {
    const dbUp = mongoose.connection.readyState === 1;
    let redisUp = false;
    try {
      redisUp = (await redis.ping()) === "PONG";
    } catch {
      redisUp = false;
    }
    const healthy = dbUp && redisUp;
    res.status(healthy ? 200 : 503);
    ok(res.status(healthy ? 200 : 503), { status: healthy ? "ok" : "degraded", version: VERSION });
  });
  return r;
}
