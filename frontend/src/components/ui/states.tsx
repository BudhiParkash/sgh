import * as React from "react";
import { AlertTriangle, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

interface StateProps {
  title: string;
  /** Heading level for the title (keep the page outline in order). Default 2. */
  level?: 2 | 3;
  description?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

/** Honest empty state — used instead of placeholder or fake items. */
export function EmptyState({ title, description, action, icon, className, level = 2 }: StateProps) {
  const H = level === 3 ? "h3" : "h2";
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-lg border border-dashed border-border-strong bg-surface-1/50 px-6 py-12 text-center",
        className,
      )}
    >
      <div className="grid size-12 place-items-center rounded-full bg-surface-2 text-muted" aria-hidden="true">
        {icon ?? <Inbox className="size-6" />}
      </div>
      <H className="text-lg font-semibold">{title}</H>
      {description && <p className="max-w-md text-sm text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

interface ErrorStateProps extends Omit<StateProps, "icon"> {
  requestId?: string;
}

export function ErrorState({ title, description, action, requestId, className, level = 2 }: ErrorStateProps) {
  const H = level === 3 ? "h3" : "h2";
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center gap-3 rounded-lg border border-danger/30 bg-danger/5 px-6 py-12 text-center",
        className,
      )}
    >
      <div className="grid size-12 place-items-center rounded-full bg-danger/10 text-danger" aria-hidden="true">
        <AlertTriangle className="size-6" />
      </div>
      <H className="text-lg font-semibold">{title}</H>
      {description && <p className="max-w-md text-sm text-muted">{description}</p>}
      {requestId && <p className="font-mono text-xs text-subtle">Reference: {requestId}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
