import mongoose from "mongoose";
import { logger } from "./logger.js";

mongoose.set("strictQuery", true);
// Never let Mongoose silently build indexes in production request paths; we sync on boot instead.
mongoose.set("autoIndex", false);

export async function connectDb(uri: string): Promise<typeof mongoose> {
  const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000, maxPoolSize: 20 });
  logger.info({ db: conn.connection.name }, "MongoDB connected");
  return conn;
}

/** Creates/updates indexes declared on all registered models. */
export async function syncIndexes(): Promise<void> {
  for (const model of Object.values(mongoose.models)) {
    await model.syncIndexes();
  }
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
