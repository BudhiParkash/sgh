import { Router } from "express";
import { z } from "zod";
import type { SearchResults } from "@sgh/shared";
import type { Cache } from "../../lib/cache.js";
import { publicFilter } from "../../lib/content/fields.js";
import { ok } from "../../lib/respond.js";
import { v, validate } from "../../middleware/validate.js";
import { ArticleModel } from "../articles/article.model.js";
import { toArticleSummary } from "../articles/article.dto.js";
import { SensitivityConfigModel } from "../sensitivity/config.model.js";
import { DeviceModel } from "../sensitivity/device.model.js";
import { toConfigSummary, toDeviceSummary } from "../sensitivity/sensitivity.dto.js";
import { TournamentModel } from "../tournaments/tournament.model.js";
import { toTournamentSummary } from "../tournaments/tournament.dto.js";

/**
 * Site search over published content (MongoDB text indexes, relevance-sorted).
 * Behind this one endpoint so the engine can later move to Atlas Search without frontend changes.
 */
export function searchRoutes(cache: Cache): Router {
  const r = Router();
  const schema = z.object({ q: z.string().trim().min(2).max(80) });
  r.get("/", validate({ query: schema }), async (req, res) => {
    const { q } = v<z.infer<typeof schema>>(req.valid.query);
    const data = await cache.cached(`search:${q.toLowerCase()}`, ["search", "articles", "tournaments", "sensitivity"], 120, async (): Promise<SearchResults> => {
      const text = { $text: { $search: q } };
      const score = { score: { $meta: "textScore" } } as const;
      const [articles, tournaments, devices, configs] = await Promise.all([
        ArticleModel.find(publicFilter(text), score).sort(score).limit(10).populate([{ path: "category", select: "name slug kind" }, { path: "author", select: "name profile" }, { path: "featuredImage" }]).lean(),
        TournamentModel.find(publicFilter(text), score).sort(score).limit(6).populate([{ path: "game", select: "key name" }, { path: "featuredImage" }]).lean(),
        DeviceModel.find(publicFilter(text), score).sort(score).limit(6).lean(),
        SensitivityConfigModel.find(publicFilter(text), score).sort(score).limit(6).populate([{ path: "game", select: "key name" }, { path: "device", select: "brand brandSlug model slug" }]).lean(),
      ]);
      return { query: q, articles: articles.map(toArticleSummary), tournaments: tournaments.map((t) => toTournamentSummary(t)), devices: devices.map((d) => toDeviceSummary(d)), sensitivity: configs.map(toConfigSummary) };
    });
    ok(res, data);
  });
  return r;
}
