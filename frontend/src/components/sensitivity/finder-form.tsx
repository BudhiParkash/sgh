"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { FPS_OPTIONS, type BrandSummary, type DeviceSummary, type FpsOption, type GyroMode, type Playstyle } from "@sgh/shared";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { Segmented } from "./segmented";

interface FinderFormProps {
  brands: BrandSummary[];
  initial?: { brand?: string; device?: string; fps?: number; gyro?: GyroMode; style?: Playstyle };
  /** Where results are shown. */
  action?: string;
}

/**
 * Sensitivity Finder form. Device list for the chosen brand is loaded from the public API.
 * Submits to /sensitivity with query parameters; the result page resolves the best match.
 */
export function FinderForm({ brands, initial, action = "/sensitivity" }: FinderFormProps) {
  const router = useRouter();
  const initialBrand = initial?.brand ?? "";
  const [brand, setBrand] = useState(initialBrand);
  const [devices, setDevices] = useState<DeviceSummary[]>([]);
  const [loading, setLoading] = useState(Boolean(initialBrand));
  const [loadError, setLoadError] = useState(false);
  const [device, setDevice] = useState(initial?.device ?? "");
  const [fpsChoice, setFps] = useState<FpsOption>((initial?.fps as FpsOption) ?? 60);
  const [gyro, setGyro] = useState<GyroMode>(initial?.gyro ?? "always_on");
  const [style, setStyle] = useState<Playstyle>(initial?.style ?? "balanced");
  const [submitting, setSubmitting] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const fetchDevices = useCallback((b: string, signal: AbortSignal) => {
    fetch(`/api/v1/devices?brand=${encodeURIComponent(b)}&hasConfigs=true&limit=50`, { signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((body: { data: DeviceSummary[] }) => setDevices(body.data))
      .catch((e: Error) => {
        if (e.name !== "AbortError") setLoadError(true);
      })
      .finally(() => {
        if (!signal.aborted) setLoading(false);
      });
  }, []);

  // Pre-selected brand (e.g. coming back from results): load its models once.
  useEffect(() => {
    if (!initialBrand) return;
    const ctrl = new AbortController();
    fetchDevices(initialBrand, ctrl.signal);
    return () => ctrl.abort();
  }, [fetchDevices, initialBrand]);

  const onBrandChange = (b: string) => {
    setBrand(b);
    setDevice("");
    setDevices([]);
    setLoadError(false);
    abortRef.current?.abort();
    if (!b) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    fetchDevices(b, ctrl.signal);
  };

  const selected = useMemo(() => devices.find((d) => d.slug === device), [devices, device]);
  const fpsAllowed = useMemo<number[]>(() => (selected?.supportedFps.length ? selected.supportedFps : [...FPS_OPTIONS]), [selected]);
  // Derived, not synced: if the chosen FPS isn't supported by the device, use its highest supported FPS.
  const fps: FpsOption = fpsAllowed.includes(fpsChoice) ? fpsChoice : ((fpsAllowed[fpsAllowed.length - 1] as FpsOption) ?? 60);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!device) return;
    setSubmitting(true);
    const q = new URLSearchParams({ device, fps: String(fps), gyro, style });
    router.push(`${action}?${q.toString()}#result`);
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" aria-label="Sensitivity finder">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="finder-brand" label="Mobile brand">
          {(aria) => (
            <Select {...aria} value={brand} onChange={(e) => onBrandChange(e.target.value)}>
              <option value="">Select brand</option>
              {brands.map((b) => (
                <option key={b.brandSlug} value={b.brandSlug}>{b.brand}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field
          id="finder-device"
          label="Mobile model"
          error={loadError ? "Couldn't load models. Please try again." : undefined}
          hint={brand && !loading && devices.length === 0 && !loadError ? "No tested models for this brand yet." : undefined}
        >
          {(aria) => (
            <Select {...aria} value={device} onChange={(e) => setDevice(e.target.value)} disabled={!brand || loading || devices.length === 0}>
              <option value="">{loading ? "Loading…" : "Select model"}</option>
              {devices.map((d) => (
                <option key={d.slug} value={d.slug}>{d.model}</option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Segmented
        name="fps"
        legend="Frame rate (FPS)"
        value={fps}
        onChange={setFps}
        options={FPS_OPTIONS.filter((f) => f >= 60 || fpsAllowed.includes(f)).map((f) => ({ value: f, label: String(f), disabled: !fpsAllowed.includes(f) }))}
      />
      <Segmented
        name="gyro"
        legend="Gyroscope"
        value={gyro}
        onChange={setGyro}
        options={[
          { value: "always_on", label: "Always on" },
          { value: "scope_on", label: "Scope on" },
          { value: "off", label: "Off" },
        ]}
      />
      <Segmented
        name="style"
        legend="Playstyle"
        value={style}
        onChange={setStyle}
        options={[
          { value: "rush", label: "Rush" },
          { value: "balanced", label: "Balanced" },
          { value: "sniper", label: "Sniper" },
        ]}
      />
      <Button type="submit" size="lg" disabled={!device} loading={submitting}>
        <Search aria-hidden="true" /> Show my settings
      </Button>
    </form>
  );
}
