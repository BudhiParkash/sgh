import { Redis } from "ioredis";
import { logger } from "./logger.js";

export function createRedis(url: string): Redis {
  const client = new Redis(url, { maxRetriesPerRequest: 2, enableReadyCheck: true, lazyConnect: false });
  client.on("error", (err) => logger.error({ err }, "Redis error"));
  return client;
}

export type { Redis };
