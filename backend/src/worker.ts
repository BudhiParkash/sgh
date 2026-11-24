import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { env } from "./config/env.js";
import { connectDb, disconnectDb } from "./config/db.js";
import { logger } from "./config/logger.js";
import { Cache } from "./lib/cache.js";
import { publishDue } from "./jobs/publish-due.js";
import { runRetentionSweep } from "./jobs/retention.js";
import { registerInboxRetention } from "./jobs/retention-rules.js";
// Register every model so the scheduler can find all workflow collections.
import "./modules/models.js";

/**
 * Background worker (separate PM2 process):
 *  - every minute: publish scheduled content
 *  - nightly 02:30 IST: data-retention sweep
 */
async function main() {
  await connectDb(env.MONGODB_URI);
  registerInboxRetention();
  const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  const cache = new Cache(new Redis(env.REDIS_URL));
  const queue = new Queue("sgh-scheduler", { connection });
  await queue.upsertJobScheduler("publish-due", { every: 60_000 }, { name: "publish-due" });
  await queue.upsertJobScheduler("retention", { pattern: "30 2 * * *", tz: "Asia/Kolkata" }, { name: "retention" });

  const worker = new Worker(
    "sgh-scheduler",
    async (job) => {
      if (job.name === "publish-due") return publishDue(cache);
      if (job.name === "retention") return runRetentionSweep();
      return null;
    },
    { connection, concurrency: 1 },
  );
  worker.on("failed", (job, err) => logger.error({ err, job: job?.name }, "Job failed"));
  logger.info("Worker started");

  const shutdown = async () => {
    await worker.close();
    await queue.close();
    await disconnectDb();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  logger.fatal({ err }, "Worker failed to start");
  process.exit(1);
});
