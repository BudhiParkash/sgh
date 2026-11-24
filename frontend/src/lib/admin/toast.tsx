"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "success" | "error" | "info";
interface Toast {
  id: number;
  tone: Tone;
  title: string;
  description?: string;
}

const ToastCtx = createContext<(t: Omit<Toast, "id">) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

let seq = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = (id: number) => setToasts((t) => t.filter((x) => x.id !== id));
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = ++seq;
    setToasts((all) => [...all.slice(-3), { ...t, id }]);
    window.setTimeout(() => dismiss(id), t.tone === "error" ? 8000 : 4000);
  }, []);
  const Icon = { success: CheckCircle2, error: XCircle, info: Info };
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end" aria-live="polite" role="status">
        {toasts.map((t) => {
          const I = Icon[t.tone];
          return (
            <div key={t.id} className="pointer-events-auto flex w-full max-w-sm animate-fade-in items-start gap-3 rounded-lg border border-border-strong bg-surface-2 p-4 shadow-lg">
              <I className={cn("mt-0.5 size-5 shrink-0", t.tone === "success" && "text-success", t.tone === "error" && "text-danger", t.tone === "info" && "text-secondary")} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{t.title}</p>
                {t.description && <p className="mt-0.5 text-xs text-muted">{t.description}</p>}
              </div>
              <button type="button" onClick={() => dismiss(t.id)} className="grid size-8 place-items-center rounded text-muted hover:text-text" aria-label="Dismiss">
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}
