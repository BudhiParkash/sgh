import { Router, type Request } from "express";
import type { Model, PopulateOptions } from "mongoose";
import { z } from "zod";
import { slugify } from "@sgh/shared";
import { hasPermission, requireAuth, requirePermission } from "../../middleware/auth.js";
import { v, validate } from "../../middleware/validate.js";
import type { Permission, PermissionModule } from "../../modules/admins/permissions.js";
import { audit, diff } from "../../modules/audit/audit.service.js";
import type { Cache } from "../cache.js";
import { AppError, badRequest, conflict, forbidden, notFound } from "../errors.js";
import { buildMeta, toSkip } from "../pagination.js";
import { created, noContent, ok } from "../respond.js";
import { revalidateTags } from "../revalidate.js";
import { createPreviewToken } from "./preview.js";
import { pingIndexNow } from "../../modules/seo/seo.routes.js";
import { MAX_REVISIONS, RevisionModel } from "./revision.model.js";
import { WORKFLOW_ACTIONS, requiredPermission, transition, type WorkflowState } from "./workflow.js";

/* eslint-disable @typescript-eslint/no-explicit-any -- the factory is generic over Mongoose models */
type AnyDoc = any;

export interface PublishCheckResult {
  blocking: string[];
  warnings: string[];
}

export interface CrudConfig {
  /** Audit/entity type, e.g. "tournament". */
  entity: string;
  /** Permission module, e.g. "tournament" → tournament:read/create/update/delete/publish. */
  perm: PermissionModule;
  model: Model<AnyDoc>;
  createSchema: z.ZodObject;
  updateSchema?: z.ZodObject;
  /** Extra list query params + how they map to a Mongo filter. */
  listQuery?: z.ZodObject;
  buildFilter?: (q: Record<string, any>) => Record<string, unknown>;
  searchFields?: string[];
  sortable?: string[];
  defaultSort?: string;
  workflow?: boolean;
  softDelete?: boolean;
  /** Field used to auto-generate a unique slug when none is given. */
  slugSource?: string;
  revisions?: boolean;
  populate?: PopulateOptions[];
  toAdmin?: (doc: AnyDoc) => unknown;
  /** Transform/validate data before it is applied (throw AppError to reject). */
  beforeSave?: (data: Record<string, any>, ctx: { req: Request; existing?: AnyDoc }) => Promise<Record<string, any>> | Record<string, any>;
  afterSave?: (doc: AnyDoc, ctx: { req: Request; action: string }) => Promise<void> | void;
  publishChecks?: (doc: AnyDoc) => Promise<PublishCheckResult> | PublishCheckResult;
  /** Next.js cache tags to revalidate when this document changes. */
  revalidate?: (doc: AnyDoc) => string[];
  /** Writers may only modify their own documents unless they hold `bypass`. */
  ownership?: { bypass: Permission };
  /** Return a reason string to block deletion (e.g. "in use"). */
  deleteGuard?: (doc: AnyDoc) => Promise<string | null> | string | null;
  cache?: Cache;
  /** Redis cache tags to invalidate on change (public API caches). */
  cacheTags?: (doc: AnyDoc) => string[];
  /** Public URL path of the document (for IndexNow pings when published content changes). */
  publicPath?: (doc: AnyDoc) => string | null;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function defaultToAdmin(doc: AnyDoc): Record<string, unknown> {
  const o = typeof doc?.toObject === "function" ? doc.toObject({ virtuals: false }) : { ...doc };
  const { _id, __v, ...rest } = o;
  return { id: String(_id), version: __v ?? 0, ...rest };
}

/** Builds a fully-featured admin router for one content type. */
export function crudRouter(cfg: CrudConfig): Router {
  const r = Router();
  const P = (action: string) => `${cfg.perm}:${action}` as Permission;
  const toAdmin = cfg.toAdmin ?? defaultToAdmin;
  const softDelete = cfg.softDelete ?? true;
  const updateSchema = cfg.updateSchema ?? cfg.createSchema.partial();

  const baseList = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    q: z.string().trim().max(100).optional(),
    status: z.string().max(20).optional(),
    sort: z.string().max(40).optional(),
    trash: z.enum(["true", "false"]).optional(),
  });
  const listSchema = cfg.listQuery ? baseList.extend(cfg.listQuery.shape) : baseList;

  async function load(id: string, includeDeleted = false) {
    if (!/^[a-f\d]{24}$/i.test(id)) throw notFound();
    const q = cfg.model.findById(id);
    if (cfg.populate) q.populate(cfg.populate);
    const doc = await q;
    if (!doc || (!includeDeleted && softDelete && doc.deleted)) throw notFound();
    return doc;
  }

  function assertOwner(req: Request, doc: AnyDoc) {
    if (!cfg.ownership) return;
    if (hasPermission(req.session?.permissions, cfg.ownership.bypass)) return;
    if (String(doc.createdBy) !== req.session?.adminId) throw forbidden("You can only change your own items.");
  }

  async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
    const root = slugify(base) || "item";
    let candidate = root;
    for (let i = 2; i < 200; i++) {
      const filter: Record<string, unknown> = { slug: candidate };
      if (softDelete) filter.deleted = false;
      if (excludeId) filter._id = { $ne: excludeId };
      if (!(await cfg.model.exists(filter))) return candidate;
      candidate = `${root}-${i}`.slice(0, 120);
    }
    throw conflict("Could not generate a unique slug.");
  }

  async function snapshot(req: Request, doc: AnyDoc, note?: string) {
    if (!cfg.revisions) return;
    const last = await RevisionModel.findOne({ entityType: cfg.entity, entityId: doc._id }).sort({ rev: -1 }).select("rev").lean();
    const rev = (last?.rev ?? 0) + 1;
    const { _id, __v, workflow, createdAt, updatedAt, deleted, deletedAt, ...content } = doc.toObject({ depopulate: true });
    await RevisionModel.create({ entityType: cfg.entity, entityId: doc._id, rev, snapshot: content, editedBy: req.session?.adminId, editedByName: req.session?.name, note });
    const stale = await RevisionModel.find({ entityType: cfg.entity, entityId: doc._id }).sort({ rev: -1 }).skip(MAX_REVISIONS).select("_id").lean();
    if (stale.length) await RevisionModel.deleteMany({ _id: { $in: stale.map((s) => s._id) } });
  }

  async function changed(doc: AnyDoc) {
    const tags = cfg.revalidate?.(doc) ?? [];
    const path = cfg.publicPath?.(doc);
    await Promise.all([revalidateTags(tags), cfg.cache?.invalidateTags(cfg.cacheTags?.(doc) ?? [cfg.entity]), path && doc.workflow?.status === "published" ? pingIndexNow([path]) : null]);
  }

  async function runChecks(doc: AnyDoc): Promise<PublishCheckResult> {
    const base: PublishCheckResult = { blocking: [], warnings: [] };
    if (cfg.workflow && doc.seo) {
      if (doc.seo.title && doc.seo.title.length > 60) base.warnings.push(`SEO title is ${doc.seo.title.length}/60 characters.`);
      if (doc.seo.description && doc.seo.description.length > 160) base.warnings.push(`Meta description is ${doc.seo.description.length}/160 characters.`);
    }
    const extra = cfg.publishChecks ? await cfg.publishChecks(doc) : { blocking: [], warnings: [] };
    return { blocking: [...base.blocking, ...extra.blocking], warnings: [...base.warnings, ...extra.warnings] };
  }

  // ── list ────────────────────────────────────────────────
  r.get("/", requireAuth(), requirePermission(P("read")), validate({ query: listSchema }), async (req, res) => {
    const q = v<z.infer<typeof baseList> & Record<string, any>>(req.valid.query);
    const filter: Record<string, unknown> = { ...(cfg.buildFilter?.(q) ?? {}) };
    if (softDelete) filter.deleted = q.trash === "true";
    if (cfg.workflow && q.status) filter["workflow.status"] = q.status;
    if (q.q && cfg.searchFields?.length) {
      const rx = new RegExp(escapeRegex(q.q), "i");
      filter.$or = cfg.searchFields.map((f) => ({ [f]: rx }));
    }
    let sort: Record<string, 1 | -1> = { [cfg.defaultSort ?? "updatedAt"]: -1 };
    if (q.sort) {
      const field = q.sort.replace(/^-/, "");
      if (!(cfg.sortable ?? ["updatedAt", "createdAt"]).includes(field)) throw badRequest("Unsupported sort field.");
      sort = { [field]: q.sort.startsWith("-") ? -1 : 1 };
    }
    const query = cfg.model.find(filter).sort(sort).skip(toSkip(q)).limit(q.limit);
    if (cfg.populate) query.populate(cfg.populate);
    const [items, total] = await Promise.all([query, cfg.model.countDocuments(filter)]);
    ok(res, items.map(toAdmin), buildMeta(q, total));
  });

  // ── get ─────────────────────────────────────────────────
  r.get("/:id", requireAuth(), requirePermission(P("read")), async (req, res) => {
    ok(res, toAdmin(await load(String(req.params.id), true)));
  });

  // ── create ──────────────────────────────────────────────
  r.post("/", requireAuth(), requirePermission(P("create")), validate({ body: cfg.createSchema }), async (req, res) => {
    let data = { ...(req.valid.body as Record<string, any>) };
    if (cfg.slugSource && "slug" in cfg.model.schema.paths) {
      data.slug = data.slug ? await uniqueSlug(data.slug) : await uniqueSlug(String(data[cfg.slugSource] ?? ""));
    }
    if (cfg.beforeSave) data = await cfg.beforeSave(data, { req });
    if (cfg.workflow) delete data.workflow;
    const doc = await cfg.model.create({ ...data, createdBy: req.session!.adminId, updatedBy: req.session!.adminId });
    await snapshot(req, doc, "Created");
    await audit(req, { action: `${cfg.entity}.create`, entityType: cfg.entity, entityId: doc.id, summary: String(doc.title ?? doc.name ?? doc.slug ?? "") });
    await cfg.afterSave?.(doc, { req, action: "create" });
    // Entities without a workflow (redirects, categories, tags) are live immediately → refresh caches.
    if (!cfg.workflow) await changed(doc);
    created(res, toAdmin(cfg.populate ? await load(doc.id) : doc));
  });

  // ── update (optimistic concurrency via If-Match: <version>) ─────────
  r.patch("/:id", requireAuth(), requirePermission(P("update")), validate({ body: updateSchema }), async (req, res) => {
    const doc = await load(String(req.params.id));
    assertOwner(req, doc);
    const ifMatch = req.get("if-match");
    if (ifMatch !== undefined && Number(ifMatch) !== (doc.__v ?? 0)) {
      throw new AppError(409, "CONFLICT", "Someone else saved this item after you opened it. Reload to see their changes.");
    }
    const before = doc.toObject({ depopulate: true });
    // PATCH semantics: apply only keys the client actually sent. (Zod's .partial() still fills
    // .default() values, which would otherwise silently reset fields such as status or sources.)
    const sent = new Set(Object.keys((req.body ?? {}) as object));
    let data = Object.fromEntries(Object.entries(req.valid.body as Record<string, any>).filter(([k]) => sent.has(k)));
    delete data.workflow;
    if (data.slug) data.slug = await uniqueSlug(data.slug, doc.id);
    if (cfg.beforeSave) data = await cfg.beforeSave(data, { req, existing: doc });
    doc.set({ ...data, updatedBy: req.session!.adminId });
    await doc.save();
    await snapshot(req, doc);
    await audit(req, { action: `${cfg.entity}.update`, entityType: cfg.entity, entityId: doc.id, changes: diff(before, doc.toObject({ depopulate: true })) });
    await cfg.afterSave?.(doc, { req, action: "update" });
    if (!cfg.workflow || doc.workflow?.status === "published") await changed(doc);
    ok(res, toAdmin(cfg.populate ? await load(doc.id) : doc));
  });

  // ── delete (soft by default; ?hard=true for Super Admin) ────────────
  r.delete("/:id", requireAuth(), requirePermission(P("delete")), async (req, res) => {
    const doc = await load(String(req.params.id), true);
    assertOwner(req, doc);
    const reason = await cfg.deleteGuard?.(doc);
    if (reason) throw conflict(reason);
    const hard = req.query.hard === "true" || !softDelete;
    if (hard && softDelete && req.session!.roleKey !== "super_admin") throw forbidden("Only a Super Admin can permanently delete.");
    if (hard) await doc.deleteOne();
    else {
      doc.deleted = true;
      doc.deletedAt = new Date();
      await doc.save();
    }
    await audit(req, { action: `${cfg.entity}.${hard ? "delete_permanent" : "delete"}`, entityType: cfg.entity, entityId: doc.id });
    await changed(doc);
    noContent(res);
  });

  if (softDelete) {
    r.post("/:id/restore", requireAuth(), requirePermission(P("delete")), async (req, res) => {
      const doc = await load(String(req.params.id), true);
      doc.deleted = false;
      doc.deletedAt = undefined;
      if (doc.slug) doc.slug = await uniqueSlug(doc.slug, doc.id);
      await doc.save();
      await audit(req, { action: `${cfg.entity}.restore`, entityType: cfg.entity, entityId: doc.id });
      await changed(doc);
      ok(res, toAdmin(doc));
    });
  }

  if (cfg.workflow) {
    const wfSchema = z.object({
      action: z.enum(WORKFLOW_ACTIONS),
      publishAt: z.coerce.date().optional(),
      note: z.string().max(500).optional(),
    });

    r.get("/:id/checks", requireAuth(), requirePermission(P("read")), async (req, res) => {
      ok(res, await runChecks(await load(String(req.params.id))));
    });

    r.post("/:id/workflow", requireAuth(), validate({ body: wfSchema }), async (req, res) => {
      const { action, publishAt, note } = v<z.infer<typeof wfSchema>>(req.valid.body);
      const need = P(requiredPermission(action));
      if (!hasPermission(req.session?.permissions, need)) throw forbidden();
      const doc = await load(String(req.params.id));
      if (action === "submit") assertOwner(req, doc);
      const next = transition(doc.workflow.toObject() as WorkflowState, action, { actorId: req.session!.adminId, publishAt, note });
      if (next.status === "published" || next.status === "scheduled") {
        const checks = await runChecks(doc);
        if (checks.blocking.length) {
          throw new AppError(400, "VALIDATION_ERROR", "This item can't be published yet.", checks.blocking.map((m) => ({ path: "publish", message: m })));
        }
      }
      const prev = doc.workflow.status;
      doc.workflow = next;
      doc.updatedBy = req.session!.adminId;
      await doc.save();
      await audit(req, { action: `${cfg.entity}.${action}`, entityType: cfg.entity, entityId: doc.id, changes: { "workflow.status": [prev, next.status] }, summary: note });
      await cfg.afterSave?.(doc, { req, action });
      if (prev === "published" || next.status === "published") await changed(doc);
      ok(res, toAdmin(cfg.populate ? await load(doc.id) : doc));
    });

    r.get("/:id/preview-token", requireAuth(), requirePermission(P("read")), async (req, res) => {
      const doc = await load(String(req.params.id));
      ok(res, { token: createPreviewToken(cfg.entity, doc.id), expiresInSec: 1800 });
    });
  }

  if (cfg.revisions) {
    r.get("/:id/revisions", requireAuth(), requirePermission(P("read")), async (req, res) => {
      const doc = await load(String(req.params.id), true);
      const revs = await RevisionModel.find({ entityType: cfg.entity, entityId: doc._id }).sort({ rev: -1 }).select("-snapshot").lean();
      ok(res, revs.map(({ _id, ...r }) => ({ id: String(_id), ...r })));
    });
    r.get("/:id/revisions/:rev", requireAuth(), requirePermission(P("read")), async (req, res) => {
      const doc = await load(String(req.params.id), true);
      const rev = await RevisionModel.findOne({ entityType: cfg.entity, entityId: doc._id, rev: Number(req.params.rev) }).lean();
      if (!rev) throw notFound();
      ok(res, rev);
    });
    r.post("/:id/revisions/:rev/restore", requireAuth(), requirePermission(P("update")), async (req, res) => {
      const doc = await load(String(req.params.id));
      assertOwner(req, doc);
      const rev = await RevisionModel.findOne({ entityType: cfg.entity, entityId: doc._id, rev: Number(req.params.rev) }).lean();
      if (!rev) throw notFound();
      const { slug: _s, createdBy: _c, ...content } = rev.snapshot as Record<string, unknown>;
      doc.set({ ...content, updatedBy: req.session!.adminId });
      await doc.save();
      await snapshot(req, doc, `Restored revision ${rev.rev}`);
      await audit(req, { action: `${cfg.entity}.revision_restore`, entityType: cfg.entity, entityId: doc.id, summary: `rev ${rev.rev}` });
      if (doc.workflow?.status === "published") await changed(doc);
      ok(res, toAdmin(doc));
    });
  }

  return r;
}
