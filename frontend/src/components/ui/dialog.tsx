"use client";

import * as React from "react";
import { Dialog as D } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

function Overlay({ className, ...props }: React.ComponentProps<typeof D.Overlay>) {
  return (
    <D.Overlay
      className={cn(
        "fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in",
        className,
      )}
      {...props}
    />
  );
}

interface ContentProps extends React.ComponentProps<typeof D.Content> {
  title: string;
  description?: string;
  /** Visually hide the title (still announced to screen readers). */
  hideTitle?: boolean;
}

export function DialogContent({ className, children, title, description, hideTitle, ...props }: ContentProps) {
  return (
    <D.Portal>
      <Overlay />
      <D.Content
        className={cn(
          "fixed top-1/2 left-1/2 z-50 max-h-[85dvh] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border-strong bg-surface-1 p-6 shadow-lg data-[state=open]:animate-dialog-in",
          className,
        )}
        {...props}
      >
        <D.Title className={cn("pr-10 text-xl font-semibold", hideTitle && "sr-only")}>{title}</D.Title>
        {description ? (
          <D.Description className="mt-1.5 text-sm text-muted">{description}</D.Description>
        ) : (
          <D.Description className="sr-only">{title}</D.Description>
        )}
        <div className="mt-5">{children}</div>
        <D.Close
          className="absolute top-3 right-3 grid size-11 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-text"
          aria-label="Close"
        >
          <X className="size-5" aria-hidden="true" />
        </D.Close>
      </D.Content>
    </D.Portal>
  );
}

interface SheetContentProps extends React.ComponentProps<typeof D.Content> {
  title: string;
  hideTitle?: boolean;
}

/** Side sheet (right) — used for the mobile menu and mobile filters. */
export function SheetContent({ className, children, title, hideTitle, ...props }: SheetContentProps) {
  return (
    <D.Portal>
      <Overlay />
      <D.Content
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-[min(88vw,380px)] flex-col border-l border-border-strong bg-surface-1 shadow-lg data-[state=closed]:animate-sheet-out data-[state=open]:animate-sheet-in",
          className,
        )}
        {...props}
      >
        <div className="flex h-[var(--header-h)] items-center justify-between border-b border-border px-4">
          <D.Title className={cn("text-base font-semibold", hideTitle && "sr-only")}>{title}</D.Title>
          <D.Description className="sr-only">{title}</D.Description>
          <D.Close
            className="ml-auto grid size-11 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-text"
            aria-label="Close menu"
          >
            <X className="size-5" aria-hidden="true" />
          </D.Close>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </D.Content>
    </D.Portal>
  );
}
