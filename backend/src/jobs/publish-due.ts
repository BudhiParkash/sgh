import mongoose from "mongoose";
import { logger } from "../config/logger.js";
import type { Cache } from "../lib/cache.js";
import { revalidateTags } from "../lib/revalidate.js";
import { AuditLogModel } from "../modules/audit/audit.model.js";

/* eslint-disable @typescript-eslint/no-explicit-any -- generic over models */
/** Next.js / API cache tags per model when an item goes live. */
const TAGS: Record<string, (d: any) => string[]> = {
  Tournament: (d) => ["tournaments", `tournament:${d.slug}`],
  GamingArticle: () => ["articles", "categories"],
  SensitivityConfig: (d) => ["sensitivity", "devices", `sensitivity:${d.slug}`],
  MobileDevice: (d) => ["devices", `device:${d.slug}`],
  Weapon: (d) => ["weapons", `weapon:${d.slug}`],
  LegalPage: (d) => ["legal", `legal:${d.slug}`],
};

/**
 * Promotes every "scheduled" item whose publishAt has passed to "published" (all workflow collections).
 * Idempotent and safe to run concurrently: each document is claimed with an atomic update.
 */
export async function publishDue(cache?: Cache, now = new Date()): Promise<number> {
  let count = 0;
  for (const model of Object.values(mongoose.models)) {
    if (!model.schema.path("workflow.status")) continue;
    const due = await model.find({ "workflow.status": "scheduled", "workflow.publishAt": { $lte: now }, deleted: { $ne: true } }).select("_id slug workflow").lean();
    for (const d of due as any[]) {
      const claimed = await model.updateOne(
        { _id: d._id, "workflow.status": "scheduled" },
        { $set: { "workflow.status": "published", "workflow.publishedAt": d.workflow?.publishedAt ?? d.workflow?.publishAt ?? now }, $unset: { "workflow.publishAt": 1 } },
      );
      if (!claimed.modifiedCount) continue;
      count++;
      const tags = [...(TAGS[model.modelName]?.(d) ?? []), "home", "sitemap", "search"];
      await Promise.all([revalidateTags(tags), cache?.invalidateTags(tags)]);
      await AuditLogModel.create({ actor: null, actorName: "Scheduler", action: `${model.modelName.toLowerCase()}.publish`, entityType: model.modelName, entityId: String(d._id), summary: "Scheduled publish" });
    }
  }
  if (count) logger.info({ count }, "Scheduled items published");
  return count;
}
