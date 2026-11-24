import { execSync, spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { MongoMemoryServer } from "mongodb-memory-server";

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, () => {
      const { port } = srv.address() as { port: number };
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

function which(bin: string): string | undefined {
  try {
    return execSync(`command -v ${bin}`, { encoding: "utf8" }).trim() || undefined;
  } catch {
    return undefined;
  }
}

/** Real MongoDB (in-memory) + real Redis for integration tests. CI may provide TEST_REDIS_URL instead. */
export default async function setup() {
  const localMongod = which("mongod");
  const mongo = await MongoMemoryServer.create({ binary: localMongod ? { systemBinary: localMongod } : undefined });
  process.env.MONGODB_URI = mongo.getUri("sgh_test");

  let redisProc: ChildProcess | undefined;
  if (process.env.TEST_REDIS_URL) {
    process.env.REDIS_URL = process.env.TEST_REDIS_URL;
  } else {
    const port = await freePort();
    redisProc = spawn("redis-server", ["--port", String(port), "--save", "", "--appendonly", "no"], { stdio: "ignore" });
    process.env.REDIS_URL = `redis://127.0.0.1:${port}`;
    await new Promise((r) => setTimeout(r, 300));
  }

  return async () => {
    redisProc?.kill();
    await mongo.stop();
  };
}
