import { Router } from "express";
import type { Model } from "mongoose";
import { ok } from "../../lib/respond.js";
import { hasPermission, requireAuth, requirePermission } from "../../middleware/auth.js";
import type { Permission } from "../admins/permissions.js";
import { AuditLogModel } from "../audit/audit.model.js";

export interface AttentionItem {
  kind: string;
  label: string;
  count: number;
  href: string;
  severity: "info" | "warning" | "danger";
}

interface ContentProvider {
  key: string;
  label: string;
  perm: Permission;
  model: Model<unknown>;
  workflow: boolean;
}

const contentProviders: ContentProvider[] = [];
const attentionProviders: { perm: Permission; fn: () => Promise<AttentionItem[]> }[] = [];

/** Modules call these at registration time so the dashboard always reflects real data. */
export function registerDashboardContent(p: ContentProvider) {
  contentProviders.push(p);
}
export function registerAttention(perm: Permission, fn: () => Promise<AttentionItem[]>) {
  attentionProviders.push({ perm, fn });
}

export function dashboardRoutes(): Router {
  const r = Router();
  r.get("/", requireAuth(), requirePermission("dashboard:read"), async (req, res) => {
    const perms = req.session!.permissions;
    const visible = contentProviders.filter((p) => hasPermission(perms, p.perm));
    const content = await Promise.all(
      visible.map(async (p) => {
        if (!p.workflow) return { key: p.key, label: p.label, total: await p.model.countDocuments({ deleted: { $ne: true } }) };
        const rows = (await p.model.aggregate([{ $match: { deleted: { $ne: true } } }, { $group: { _id: "$workflow.status", n: { $sum: 1 } } }])) as { _id: string; n: number }[];
        const byStatus = Object.fromEntries(rows.map((x) => [x._id, x.n]));
        return { key: p.key, label: p.label, total: rows.reduce((s, x) => s + x.n, 0), byStatus };
      }),
    );
    const attention = (await Promise.all(attentionProviders.filter((a) => hasPermission(perms, a.perm)).map((a) => a.fn()))).flat().filter((a) => a.count > 0);

    let activity: { date: string; count: number }[] = [];
    let recent: unknown[] = [];
    if (hasPermission(perms, "audit:read")) {
      const since = new Date(Date.now() - 30 * 86_400_000);
      activity = (
        await AuditLogModel.aggregate([
          { $match: { at: { $gte: since }, action: { $regex: "\\.publish$" } } },
          { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$at", timezone: "Asia/Kolkata" } }, count: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ])
      ).map((x) => ({ date: x._id as string, count: x.count as number }));
      recent = (await AuditLogModel.find({ action: { $not: /^auth\./ } }).sort({ at: -1 }).limit(12).lean()).map(({ _id, ...x }) => ({ id: String(_id), ...x }));
    }
    ok(res, { content, attention, activity, recent });
  });
  return r;
}
