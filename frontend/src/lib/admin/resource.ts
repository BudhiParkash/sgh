import type { ReactNode } from "react";
import { z } from "zod";

export interface Option {
  value: string;
  label: string;
}

interface Base {
  name: string;
  label: string;
  hint?: string;
  required?: boolean;
  /** Full-width in the 2-column form grid. */
  wide?: boolean;
  /** Hide the field unless the predicate on current values is true. */
  showIf?: (values: Record<string, unknown>) => boolean;
}

export type FieldDef =
  | (Base & { type: "text" | "textarea" | "url" | "email" | "slug"; max?: number; min?: number; placeholder?: string; rows?: number })
  | (Base & { type: "number"; min?: number; max?: number; step?: number })
  | (Base & { type: "select"; options: Option[] })
  | (Base & { type: "multiselect"; options: Option[] })
  | (Base & { type: "checkbox" })
  | (Base & { type: "date" | "datetime" })
  | (Base & { type: "media"; category?: string })
  | (Base & { type: "reference" | "references"; endpoint: string; labelKey: string; labelOf?: (doc: Record<string, unknown>) => string; query?: Record<string, string> })
  | (Base & { type: "list"; itemFields: FieldDef[]; addLabel: string; max?: number })
  | (Base & { type: "richtext" })
  | (Base & { type: "custom"; render: (p: { value: unknown; onChange: (v: unknown) => void; values: Record<string, unknown>; error?: string }) => ReactNode });

export interface Column<T = Record<string, unknown>> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  /** Shown on mobile card layout. */
  primary?: boolean;
  className?: string;
}

export interface ResourceDef<T = Record<string, unknown>> {
  key: string;
  title: string;
  singular: string;
  endpoint: string;
  perm: string;
  workflow?: boolean;
  revisions?: boolean;
  /** Hide "New" (e.g. inbox-type resources). */
  canCreate?: boolean;
  /** false when the API has no trash/restore (hard delete). */
  softDelete?: boolean;
  description?: string;
  filters?: { name: string; label: string; options: Option[] }[];
  columns: Column<T>[];
  sections: { title: string; fields: FieldDef[] }[];
  defaults?: Record<string, unknown>;
  /** API document → form values. */
  toForm?: (doc: T) => Record<string, unknown>;
  /** Form values → API payload. */
  fromForm?: (values: Record<string, unknown>) => Record<string, unknown>;
  titleOf?: (doc: T) => string;
  publicUrl?: (doc: T) => string | null;
  /** Extra panel(s) in the editor sidebar (e.g. tournament verification). */
  sidePanel?: (doc: T, onChanged: (doc: T) => void) => ReactNode;
  previewPath?: string;
}

const allFields = (fields: FieldDef[]): FieldDef[] => fields;

/** Client-side validation derived from field definitions (server re-validates authoritatively). */
export function buildSchema(def: ResourceDef): z.ZodType<Record<string, unknown>> {
  const shape: Record<string, z.ZodType> = {};
  for (const f of def.sections.flatMap((s) => allFields(s.fields))) {
    if (f.name.includes(".")) continue; // nested (e.g. seo.*) — validated server-side
    let s: z.ZodType;
    switch (f.type) {
      case "text":
      case "textarea":
      case "slug": {
        let t = z.string().trim();
        if (f.max) t = t.max(f.max, `At most ${f.max} characters`);
        if (f.required) t = t.min(f.min ?? 1, "Required");
        if (f.type === "slug") t = t.regex(/^$|^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and hyphens only");
        s = f.required ? t : t.optional().or(z.literal(""));
        break;
      }
      case "url": {
        const t = z.string().trim().refine((v) => v === "" || /^https:\/\/\S+$/.test(v), "Must be a full https:// link");
        s = f.required ? t.refine((v) => v !== "", "Required") : t.optional();
        break;
      }
      case "email":
        s = f.required ? z.string().email("Enter a valid email") : z.union([z.literal(""), z.string().email("Enter a valid email")]).optional();
        break;
      case "number": {
        let n = z.coerce.number({ message: "Enter a number" });
        if (f.min !== undefined) n = n.min(f.min);
        if (f.max !== undefined) n = n.max(f.max);
        s = f.required ? n : z.union([z.literal(""), z.null(), n]).optional();
        break;
      }
      case "select":
      case "reference":
      case "media":
        s = f.required ? z.string({ message: "Required" }).min(1, "Required") : z.string().optional().nullable();
        break;
      default:
        s = z.any();
    }
    shape[f.name] = s;
  }
  return z.object(shape).passthrough() as unknown as z.ZodType<Record<string, unknown>>;
}

/** ISO (UTC) ⇄ <input type="datetime-local"> in the browser's zone (admins are in IST). */
export function isoToLocalInput(iso: unknown): string {
  if (typeof iso !== "string" || !iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function localInputToIso(v: unknown): string | null {
  if (typeof v !== "string" || !v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
export const isoToDateInput = (iso: unknown) => (typeof iso === "string" && iso ? iso.slice(0, 10) : "");
