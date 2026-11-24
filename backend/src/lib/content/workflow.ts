import type { WorkflowStatus } from "@sgh/shared";
import { badRequest } from "../errors.js";

export const WORKFLOW_ACTIONS = ["submit", "reject", "approve", "schedule", "publish", "unpublish", "archive", "restore"] as const;
export type WorkflowAction = (typeof WORKFLOW_ACTIONS)[number];

/** Allowed source statuses → target status, and which permission action is needed. */
const RULES: Record<WorkflowAction, { from: WorkflowStatus[]; to: WorkflowStatus; perm: "update" | "publish" }> = {
  submit: { from: ["draft"], to: "review", perm: "update" },
  reject: { from: ["review", "approved"], to: "draft", perm: "publish" },
  approve: { from: ["review"], to: "approved", perm: "publish" },
  schedule: { from: ["draft", "review", "approved"], to: "scheduled", perm: "publish" },
  publish: { from: ["draft", "review", "approved", "scheduled"], to: "published", perm: "publish" },
  unpublish: { from: ["published", "scheduled"], to: "draft", perm: "publish" },
  archive: { from: ["published", "draft", "approved"], to: "archived", perm: "publish" },
  restore: { from: ["archived"], to: "draft", perm: "publish" },
};

export function requiredPermission(action: WorkflowAction): "update" | "publish" {
  return RULES[action].perm;
}

export interface WorkflowState {
  status: WorkflowStatus;
  publishAt?: Date | null;
  publishedAt?: Date | null;
  archivedAt?: Date | null;
  submittedAt?: Date | null;
  reviewedBy?: unknown;
  approvedBy?: unknown;
  note?: string | null;
}

/** Pure transition function — unit-testable. Returns the next workflow state. */
export function transition(
  current: WorkflowState,
  action: WorkflowAction,
  opts: { actorId: string; publishAt?: Date; note?: string; now?: Date },
): WorkflowState {
  const rule = RULES[action];
  const now = opts.now ?? new Date();
  if (!rule.from.includes(current.status)) {
    throw badRequest(`Can't ${action} an item that is ${current.status}.`);
  }
  const next: WorkflowState = { ...current, status: rule.to, note: opts.note ?? current.note ?? undefined };
  switch (action) {
    case "submit":
      next.submittedAt = now;
      break;
    case "approve":
      next.approvedBy = opts.actorId;
      next.reviewedBy = opts.actorId;
      break;
    case "reject":
      next.reviewedBy = opts.actorId;
      break;
    case "schedule":
      if (!opts.publishAt || opts.publishAt.getTime() <= now.getTime() + 60_000) {
        throw badRequest("Choose a publish time at least one minute in the future.", [{ path: "publishAt", message: "Must be in the future" }]);
      }
      next.publishAt = opts.publishAt;
      next.approvedBy = opts.actorId;
      break;
    case "publish":
      next.publishedAt = current.publishedAt ?? now; // keep original publish date on re-publish
      next.publishAt = undefined;
      next.approvedBy = opts.actorId;
      break;
    case "unpublish":
      next.publishAt = undefined;
      break;
    case "archive":
      next.archivedAt = now;
      break;
    case "restore":
      next.archivedAt = undefined;
      break;
  }
  return next;
}
