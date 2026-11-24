import { afterAll, beforeAll, beforeEach } from "vitest";

// Must be set before src/config/env.ts is imported by any test.
process.env.NODE_ENV = "test";
process.env.SITE_ENV = "local";
process.env.LOG_LEVEL = "silent";
process.env.HASH_SECRET = "test-hash-secret-0123456789abcdefghijklmnop";
process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
process.env.REVALIDATE_SECRET = "test-revalidate-secret-0123456789abcdefghij";
process.env.CORS_ORIGINS = "http://localhost:3000";
process.env.SITE_URL = "http://localhost:3000";
process.env.LOCAL_MEDIA_DIR = (await import("node:os")).tmpdir() + "/sgh-test-media-" + process.pid;

const { default: mongoose } = await import("mongoose");
const { createRedis } = await import("../src/config/redis.js");
const { syncIndexes } = await import("../src/config/db.js");

export const testRedis = createRedis(process.env.REDIS_URL!);

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) await mongoose.connect(process.env.MONGODB_URI!);
  await syncIndexes();
});

beforeEach(async () => {
  await testRedis.flushdb();
  const collections = await mongoose.connection.db!.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  testRedis.disconnect();
});
