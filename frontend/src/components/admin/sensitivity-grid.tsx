"use client";

import { useState } from "react";
import { CATEGORY_LABELS, SCOPE_KEYS, SCOPE_LABELS, SENSITIVITY_RANGES, type SensitivityCategory } from "@sgh/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/field";
import { cn } from "@/lib/utils";

type Grid = Partial<Record<SensitivityCategory, Partial<Record<string, number | null>>>>;

/**
 * Values grid: 9 scopes × up to 4 categories (gyro columns appear only when gyroscope is on).
 * Supports copying a column and pasting a block from a spreadsheet (tab/comma separated).
 */
export function SensitivityGrid({ value, onChange, gyroscope, error }: { value: unknown; onChange: (v: Grid) => void; gyroscope: string; error?: string }) {
  const grid: Grid = (value && typeof value === "object" ? value : {}) as Grid;
  const cats: SensitivityCategory[] = gyroscope === "off" ? ["camera", "ads"] : ["camera", "ads", "gyro", "ads_gyro"];
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);

  const set = (cat: SensitivityCategory, scope: string, raw: string) => {
    const n = raw === "" ? null : Math.round(Number(raw));
    onChange({ ...grid, [cat]: { ...(grid[cat] ?? {}), [scope]: Number.isFinite(n) ? n : null } });
  };
  const copy = (from: SensitivityCategory, to: SensitivityCategory) => onChange({ ...grid, [to]: { ...(grid[from] ?? {}) } });
  const applyPaste = () => {
    const rows = pasteText.trim().split(/\r?\n/).map((l) => l.split(/[\t,;]+/).map((x) => x.trim()).filter(Boolean));
    if (rows.length !== SCOPE_KEYS.length) return setPasteError(`Paste exactly ${SCOPE_KEYS.length} rows (one per scope, top to bottom).`);
    const next: Grid = { ...grid };
    for (let ci = 0; ci < cats.length; ci++) {
      const cat = cats[ci]!;
      const col: Record<string, number | null> = {};
      for (let ri = 0; ri < SCOPE_KEYS.length; ri++) {
        const cell = rows[ri]![ci];
        if (cell === undefined) continue;
        const n = Number(cell);
        if (!Number.isFinite(n)) return setPasteError(`Row ${ri + 1}, column ${ci + 1} isn't a number.`);
        col[SCOPE_KEYS[ri]!] = Math.round(n);
      }
      if (Object.keys(col).length) next[cat] = { ...(grid[cat] ?? {}), ...col };
    }
    onChange(next);
    setPasteOpen(false);
    setPasteText("");
    setPasteError(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[520px] text-sm">
          <caption className="sr-only">Sensitivity values by scope</caption>
          <thead className="bg-surface-1 text-xs text-subtle">
            <tr>
              <th scope="col" className="sticky left-0 bg-surface-1 px-3 py-2 text-left font-medium">Scope</th>
              {cats.map((c) => (
                <th key={c} scope="col" className="px-2 py-2 text-left font-medium">
                  {CATEGORY_LABELS[c]}
                  <span className="block font-normal">{SENSITIVITY_RANGES[c].min}–{SENSITIVITY_RANGES[c].max}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {SCOPE_KEYS.map((s) => (
              <tr key={s}>
                <th scope="row" className="sticky left-0 bg-surface-1 px-3 py-1.5 text-left font-normal whitespace-nowrap text-muted">{SCOPE_LABELS[s]}</th>
                {cats.map((c) => {
                  const v = grid[c]?.[s];
                  const { min, max } = SENSITIVITY_RANGES[c];
                  const bad = typeof v === "number" && (v < min || v > max);
                  return (
                    <td key={c} className="px-2 py-1">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={min}
                        max={max}
                        step={1}
                        aria-label={`${CATEGORY_LABELS[c]} — ${SCOPE_LABELS[s]}`}
                        aria-invalid={bad || undefined}
                        value={v ?? ""}
                        onChange={(e) => set(c, s, e.target.value)}
                        className={cn("h-10 w-20 rounded-md border bg-surface-1 px-2 font-mono text-sm", bad ? "border-danger" : "border-border-strong focus:border-primary")}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={() => setPasteOpen(true)}>Paste from spreadsheet</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => copy("camera", "ads")}>Copy Camera → ADS</Button>
        {gyroscope !== "off" && <Button type="button" size="sm" variant="ghost" onClick={() => copy("gyro", "ads_gyro")}>Copy Gyro → ADS gyro</Button>}
      </div>
      <Dialog open={pasteOpen} onOpenChange={setPasteOpen}>
        <DialogContent title="Paste values" description={`9 rows (scopes, top to bottom) × ${cats.length} columns (${cats.map((c) => CATEGORY_LABELS[c]).join(", ")}).`}>
          <div className="flex flex-col gap-3">
            <Textarea aria-label="Values to paste" rows={10} value={pasteText} onChange={(e) => setPasteText(e.target.value)} className="font-mono" placeholder={"120\t100\t300\t300\n…"} />
            {pasteError && <p role="alert" className="text-sm text-danger">{pasteError}</p>}
            <Button type="button" onClick={applyPaste} disabled={!pasteText.trim()}>Apply</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
