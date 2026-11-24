// Removes Next.js runtime/data caches so a build or E2E run never reuses data fetched from a
// previous (different) database. Build artifacts themselves are left intact.
import { rmSync } from "node:fs";

for (const dir of [".next/cache/fetch-cache", ".next/server/route-cache"]) {
  rmSync(dir, { recursive: true, force: true });
}
