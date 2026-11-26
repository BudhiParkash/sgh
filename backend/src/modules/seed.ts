import { ensureSystemRoles } from "./admins/role.service.js";
import { CategoryModel, DEFAULT_CATEGORIES } from "./categories/category.model.js";
import { OWNER_PROVIDED_DEFAULTS, getSettings } from "./settings/settings.model.js";
import { DEFAULT_GAMES, GameModel } from "./games/game.model.js";
import { DEFAULT_SCOPES, ScopeModel } from "./sensitivity/scope.model.js";
import { LEGAL_DRAFTS } from "./legal/legal.drafts.js";
import { LegalPageModel } from "./legal/legal.model.js";
import { processHtml } from "../lib/content/html.js";

/** Idempotent reference-data seed. Never creates fake content. Extended by later modules. */
export async function seedReferenceData(): Promise<Record<string, string | number>> {
  await ensureSystemRoles();
  let categories = 0;
  for (const c of DEFAULT_CATEGORIES) {
    const r = await CategoryModel.updateOne({ slug: c.slug, deleted: false }, { $setOnInsert: c }, { upsert: true });
    categories += r.upsertedCount;
  }
  for (const g of DEFAULT_GAMES) await GameModel.updateOne({ key: g.key }, { $setOnInsert: g }, { upsert: true });
  for (const sc of DEFAULT_SCOPES) await ScopeModel.updateOne({ key: sc.key }, { $setOnInsert: sc }, { upsert: true });
  // Legal drafts are created as unpublished drafts (counsel review required before publishing).
  let legal = 0;
  let legalRefreshed = 0;
  for (const [slug, d] of Object.entries(LEGAL_DRAFTS)) {
    const p = processHtml(d.html);
    const existing = await LegalPageModel.findOne({ slug }).lean<{ _id: unknown; createdAt?: Date; updatedAt?: Date; version?: number; content?: { html?: string } }>();
    if (!existing) {
      await LegalPageModel.create({ slug, title: d.title, content: { html: p.html, headings: p.headings }, reviewedByCounsel: false });
      legal++;
      continue;
    }
    // Refresh a draft only if nobody has edited or published it (never touches reviewed or human-edited text).
    const untouched = !existing.version && existing.createdAt && existing.updatedAt && Math.abs(+existing.updatedAt - +existing.createdAt) < 2000;
    if (untouched && existing.content?.html !== p.html) {
      await LegalPageModel.collection.updateOne({ _id: existing._id as never }, { $set: { title: d.title, "content.html": p.html, "content.headings": p.headings } });
      legalRefreshed++;
    }
  }
  const s = await getSettings();
  for (const [path, value] of Object.entries(OWNER_PROVIDED_DEFAULTS)) if (!s.get(path)) s.set(path, value);
  await s.save();
  return { roles: "ok", games: DEFAULT_GAMES.length, scopes: DEFAULT_SCOPES.length, categoriesCreated: categories, settings: "ok", legalDraftsCreated: legal, legalDraftsRefreshed: legalRefreshed };
}
