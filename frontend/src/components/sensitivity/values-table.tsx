import { CATEGORY_LABELS, SCOPE_KEYS, SCOPE_LABELS, SENSITIVITY_CATEGORIES, type SensitivityValues } from "@sgh/shared";
import { cn } from "@/lib/utils";

/**
 * All values in one server-rendered table (visible to crawlers and AI answer engines — no hidden tabs).
 * On phones the table scrolls horizontally inside its own box with a sticky scope column.
 */
export function ValuesTable({ values, caption, compareTo }: { values: SensitivityValues; caption: string; compareTo?: SensitivityValues }) {
  const cats = SENSITIVITY_CATEGORIES.filter((c) => values[c] && Object.values(values[c]!).some((v) => v !== null));
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[480px] text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-surface-1 text-xs text-subtle">
          <tr>
            <th scope="col" className="sticky left-0 z-10 bg-surface-1 px-4 py-3 text-left font-medium">Scope</th>
            {cats.map((c) => <th key={c} scope="col" className="px-4 py-3 text-right font-medium">{CATEGORY_LABELS[c]}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {SCOPE_KEYS.map((s) => (
            <tr key={s} className="hover:bg-surface-1/60">
              <th scope="row" className="sticky left-0 z-10 bg-bg px-4 py-2.5 text-left font-normal whitespace-nowrap text-muted">{SCOPE_LABELS[s]}</th>
              {cats.map((c) => {
                const v = values[c]?.[s] ?? null;
                const other = compareTo?.[c]?.[s];
                const delta = typeof v === "number" && typeof other === "number" ? v - other : null;
                return (
                  <td key={c} className="px-4 py-2.5 text-right font-mono text-base tabular-nums">
                    {v ?? "—"}
                    {delta !== null && delta !== 0 && <span className={cn("ml-2 text-xs", delta > 0 ? "text-accent" : "text-warning")}>{delta > 0 ? `+${delta}` : delta}</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
