import { Router } from "express";
import type { Cache } from "../../lib/cache.js";
import { ok } from "../../lib/respond.js";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { GameModel } from "./game.model.js";

const dto = (g: { _id: unknown; key: string; name: string; slug: string }) => ({ id: String(g._id), key: g.key, name: g.name, slug: g.slug });

export function gamePublicRoutes(cache: Cache): Router {
  const r = Router();
  r.get("/", async (_req, res) => ok(res, await cache.cached("games", ["games"], 3600, async () => (await GameModel.find({ isActive: true }).sort({ name: 1 }).lean()).map(dto))));
  return r;
}

export function gameAdminRoutes(): Router {
  const r = Router();
  r.get("/", requireAuth(), requirePermission("game:read"), async (_req, res) => ok(res, (await GameModel.find().sort({ name: 1 }).lean()).map(dto)));
  return r;
}
