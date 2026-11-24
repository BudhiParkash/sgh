import { Router } from "express";
import type { HomeData } from "@sgh/shared";
import type { Cache } from "../../lib/cache.js";
import { ok } from "../../lib/respond.js";

type Provider = () => Promise<Partial<HomeData>>;
const providers: Provider[] = [];

/** Modules contribute homepage sections (tournaments, devices, articles…). */
export function registerHomeProvider(p: Provider) {
  providers.push(p);
}

const EMPTY: HomeData = { featuredTournaments: [], popularDevices: [], brands: [], weapons: [], latestNews: [], latestGuides: [], resources: [] };

export function homeRoutes(cache: Cache): Router {
  const r = Router();
  r.get("/", async (_req, res) => {
    const data = await cache.cached("home", ["home"], 120, async () => {
      const parts = await Promise.all(providers.map((p) => p()));
      return Object.assign({ ...EMPTY }, ...parts) as HomeData;
    });
    ok(res, data);
  });
  return r;
}
