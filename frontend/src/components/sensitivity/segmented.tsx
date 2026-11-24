"use client";

import { cn } from "@/lib/utils";

interface Option<T extends string | number> {
  value: T;
  label: string;
  disabled?: boolean;
}

/** Accessible segmented control (radio group) with 44px targets. */
export function Segmented<T extends string | number>({
  name,
  legend,
  options,
  value,
  onChange,
}: {
  name: string;
  legend: string;
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-surface-1 p-1">
        {options.map((o) => {
          const id = `${name}-${o.value}`;
          const checked = o.value === value;
          return (
            <label
              key={id}
              htmlFor={id}
              className={cn(
                "relative flex min-h-11 min-w-16 flex-1 cursor-pointer items-center justify-center rounded-md px-3 text-sm font-medium transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary",
                checked ? "bg-surface-3 text-text shadow-sm" : "text-muted hover:text-text",
                o.disabled && "cursor-not-allowed opacity-40",
              )}
            >
              <input
                id={id}
                type="radio"
                name={name}
                value={String(o.value)}
                checked={checked}
                disabled={o.disabled}
                onChange={() => onChange(o.value)}
                className="sr-only"
              />
              {o.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
