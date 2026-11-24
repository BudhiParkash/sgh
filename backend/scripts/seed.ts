/**
 * Seeds reference data only (roles, games, scopes, categories). Never seeds fake content.
 *   pnpm --filter @sgh/backend seed
 */
import { env } from "../src/config/env.js";
import { connectDb, disconnectDb, syncIndexes } from "../src/config/db.js";
import { seedReferenceData } from "../src/modules/seed.js";

await connectDb(env.MONGODB_URI);
await syncIndexes();
const summary = await seedReferenceData();
console.log("Seed complete:", summary);
await disconnectDb();
