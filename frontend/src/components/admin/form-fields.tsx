"use client";

import { Controller, useFieldArray, useWatch, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { adminFetch } from "@/lib/admin/api";
import type { FieldDef } from "@/lib/admin/resource";
import { cn } from "@/lib/utils";
import { MediaPicker } from "./media-picker";
import { RichTextField } from "./rich-text-field";

/* eslint-disable @typescript-eslint/no-explicit-any -- dynamic form values */
type Values = Record<string, any>;

function errorAt(errors: FieldErrors, path: string): string | undefined {
  const e = path.split(".").reduce<any>((acc, k) => acc?.[k], errors);
  return typeof e?.message === "string" ? e.message : undefined;
}

function ReferenceSelect({ f, value, onChange, id, aria, multiple }: { f: Extract<FieldDef, { type: "reference" | "references" }>; value: any; onChange: (v: any) => void; id: string; aria: object; multiple?: boolean }) {
  const q = useQuery({
    queryKey: ["ref", f.endpoint, f.query],
    queryFn: async () => (await adminFetch<Record<string, any>[]>(f.endpoint, { query: { limit: 100, ...f.query } })).data,
    staleTime: 60_000,
  });
  const options = (q.data ?? []).map((d) => ({ value: d.id as string, label: f.labelOf ? f.labelOf(d) : String(d[f.labelKey] ?? d.id) }));
  if (multiple) {
    const selected: string[] = Array.isArray(value) ? value.map((x: any) => (typeof x === "object" ? x.id ?? x._id : x)) : [];
    return (
      <div id={id} className="flex flex-wrap gap-2 rounded-md border border-border-strong p-2" role="group" aria-label={f.label}>
        {q.isLoading && <span className="text-sm text-muted">Loading…</span>}
        {options.map((o) => {
          const on = selected.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? selected.filter((x) => x !== o.value) : [...selected, o.value])}
              className={cn("min-h-9 rounded-full border px-3 text-sm", on ? "border-primary bg-primary/15 text-text" : "border-border-strong text-muted hover:text-text")}
            >
              {o.label}
            </button>
          );
        })}
        {options.length === 0 && !q.isLoading && <span className="text-sm text-muted">Nothing to choose yet.</span>}
      </div>
    );
  }
  const current = value && typeof value === "object" ? (value.id ?? value._id) : value;
  return (
    <Select {...aria} value={current ?? ""} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">{q.isLoading ? "Loading…" : `Select ${f.label.toLowerCase()}`}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </Select>
  );
}

function ListField({ f, control, register, errors, prefix }: { f: Extract<FieldDef, { type: "list" }>; control: Control<Values>; register: UseFormRegister<Values>; errors: FieldErrors; prefix: string }) {
  const { fields, append, remove } = useFieldArray({ control, name: prefix });
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-sm font-medium">{f.label}</legend>
      {f.hint && <p className="-mt-2 text-xs text-muted">{f.hint}</p>}
      {fields.map((item, i) => (
        <div key={item.id} className="grid gap-3 rounded-lg border border-border bg-surface-1 p-3 sm:grid-cols-2">
          {f.itemFields.map((sf) => (
            <FieldRenderer key={sf.name} f={sf} control={control} register={register} errors={errors} path={`${prefix}.${i}.${sf.name}`} />
          ))}
          <div className="sm:col-span-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => remove(i)}>
              <Trash2 aria-hidden="true" /> Remove
            </Button>
          </div>
        </div>
      ))}
      {(!f.max || fields.length < f.max) && (
        <Button type="button" variant="secondary" size="sm" className="w-fit" onClick={() => append(Object.fromEntries(f.itemFields.map((x) => [x.name, x.type === "checkbox" ? false : ""])))}>
          <Plus aria-hidden="true" /> {f.addLabel}
        </Button>
      )}
    </fieldset>
  );
}

export function FieldRenderer({ f, control, register, errors, path }: { f: FieldDef; control: Control<Values>; register: UseFormRegister<Values>; errors: FieldErrors; path?: string }) {
  const name = path ?? f.name;
  const values = useWatch({ control }) as Values;
  if (f.showIf && !f.showIf(values)) return null;
  const error = errorAt(errors, name);
  const id = `f-${name.replace(/\./g, "-")}`;
  const wrap = (node: React.ReactNode) => <div className={cn(f.wide || f.type === "list" || f.type === "richtext" || f.type === "textarea" ? "sm:col-span-2" : undefined)}>{node}</div>;

  switch (f.type) {
    case "list":
      return wrap(<ListField f={f} control={control} register={register} errors={errors} prefix={name} />);
    case "checkbox":
      return wrap(
        <label htmlFor={id} className="flex min-h-11 cursor-pointer items-start gap-3">
          <input id={id} type="checkbox" {...register(name)} className="mt-1 size-5 accent-[var(--primary)]" />
          <span>
            <span className="text-sm font-medium">{f.label}</span>
            {f.hint && <span className="block text-xs text-muted">{f.hint}</span>}
          </span>
        </label>,
      );
    default:
      break;
  }

  return wrap(
    <Field id={id} label={f.label} hint={f.hint} error={error} required={f.required}>
      {(aria) => {
        switch (f.type) {
          case "text":
          case "url":
          case "email":
          case "slug":
            return <Input {...aria} {...register(name)} type={f.type === "slug" ? "text" : f.type} maxLength={f.max} placeholder={f.placeholder ?? (f.type === "slug" ? "auto-generated from the title" : undefined)} inputMode={f.type === "url" ? "url" : undefined} autoComplete="off" />;
          case "textarea":
            return <Textarea {...aria} {...register(name)} rows={f.rows ?? 4} maxLength={f.max} placeholder={f.placeholder} />;
          case "number":
            return <Input {...aria} {...register(name)} type="number" inputMode="decimal" min={f.min} max={f.max} step={f.step ?? "any"} />;
          case "date":
            return <Input {...aria} {...register(name)} type="date" />;
          case "datetime":
            return <Input {...aria} {...register(name)} type="datetime-local" />;
          case "select":
            return (
              <Select {...aria} {...register(name)}>
                <option value="">Select…</option>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            );
          case "multiselect":
            return (
              <Controller
                control={control}
                name={name}
                render={({ field }) => {
                  const sel: string[] = Array.isArray(field.value) ? field.value : [];
                  return (
                    <div id={aria.id} className="flex flex-wrap gap-2" role="group" aria-label={f.label}>
                      {f.options.map((o) => {
                        const on = sel.includes(o.value);
                        return (
                          <button key={o.value} type="button" aria-pressed={on} onClick={() => field.onChange(on ? sel.filter((x) => x !== o.value) : [...sel, o.value])} className={cn("min-h-9 rounded-full border px-3 text-sm", on ? "border-primary bg-primary/15 text-text" : "border-border-strong text-muted hover:text-text")}>
                            {o.label}
                          </button>
                        );
                      })}
                    </div>
                  );
                }}
              />
            );
          case "media":
            return <Controller control={control} name={name} render={({ field }) => <MediaPicker value={field.value} onChange={field.onChange} category={f.category} invalid={Boolean(error)} />} />;
          case "reference":
          case "references":
            return <Controller control={control} name={name} render={({ field }) => <ReferenceSelect f={f} value={field.value} onChange={field.onChange} id={aria.id} aria={aria} multiple={f.type === "references"} />} />;
          case "richtext":
            return <Controller control={control} name={name} render={({ field }) => <RichTextField id={aria.id} value={field.value} onChange={field.onChange} invalid={Boolean(error)} />} />;
          case "custom":
            return <Controller control={control} name={name} render={({ field }) => <>{f.render({ value: field.value, onChange: field.onChange, values, error })}</>} />;
          default:
            return <></>;
        }
      }}
    </Field>,
  );
}
