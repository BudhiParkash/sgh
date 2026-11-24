import { env } from "./config/env.js";
import { connectDb, disconnectDb, syncIndexes } from "./config/db.js";
import { logger } from "./config/logger.js";
import { createRedis } from "./config/redis.js";
import { createApp } from "./app.js";
import { ensureSystemRoles } from "./modules/admins/role.service.js";

async function main() {
  await connectDb(env.MONGODB_URI);
  await syncIndexes();
  await ensureSystemRoles();
  const redis = createRedis(env.REDIS_URL);
  const app = createApp({ redis });
  const server = app.listen(env.PORT, "127.0.0.1", () => logger.info({ port: env.PORT }, "API listening"));

  const shutdown = (signal: string) => {
    logger.info({ signal }, "Shutting down");
    server.close(async () => {
      await Promise.allSettled([disconnectDb(), redis.quit()]);
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  logger.fatal({ err }, "Failed to start");
  process.exit(1);
});
