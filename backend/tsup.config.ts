import { defineConfig } from "tsup";

export default defineConfig({
  entry: { server: "src/server.ts", worker: "src/worker.ts", seed: "scripts/seed.ts", "create-super-admin": "scripts/create-super-admin.ts" },
  format: ["esm"],
  target: "node22",
  platform: "node",
  sourcemap: true,
  clean: true,
  // bundle the workspace package (TS source); keep real npm deps external
  noExternal: ["@sgh/shared"],
});
