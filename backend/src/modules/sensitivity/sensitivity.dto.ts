import { MIN_INDEXABLE_WORDS, type DeviceDetail, type DeviceSummary, type SensitivityCodeDto, type SensitivityDetail, type SensitivitySummary, type WeaponDetail, type WeaponSummary } from "@sgh/shared";
import { SCOPE_LABELS } from "@sgh/shared";
import { toGameRef } from "../games/game.model.js";
import { toMediaRef } from "../media/media.service.js";

/* eslint-disable @typescript-eslint/no-explicit-any -- populated lean documents */
const iso = (d: unknown) => (d ? new Date(d as string).toISOString() : null);
const deviceRef = (d: any) => (d && typeof d === "object" && "model" in d ? { slug: d.slug, brand: d.brand, brandSlug: d.brandSlug, model: d.model } : null);

function seo(x: any, forceNoindex = false) {
  return {
    title: x.seo?.title ?? null,
    description: x.seo?.description ?? null,
    canonicalUrl: x.seo?.canonicalUrl ?? null,
    robots: { index: !forceNoindex && (x.seo?.robots?.index ?? true), follow: x.seo?.robots?.follow ?? true },
    ogImage: toMediaRef(x.seo?.ogImage),
  };
}

export function toConfigSummary(c: any): SensitivitySummary {
  return {
    id: String(c._id),
    slug: c.slug,
    title: c.title,
    game: toGameRef(c.game) ?? { key: "bgmi", name: "BGMI" },
    device: deviceRef(c.device),
    fps: c.fps,
    gyroscope: c.gyroscope,
    playstyle: c.playstyle,
    provenance: c.provenance,
    gameVersion: c.gameVersion ?? null,
    testedAt: iso(c.testing?.testedAt),
    version: c.valuesVersion ?? 1,
    updatedAt: iso(c.updatedAt)!,
  };
}

const cleanValues = (v: any) => {
  if (!v) return {};
  const out: Record<string, Record<string, number | null>> = {};
  for (const [cat, row] of Object.entries(v)) {
    if (!row || typeof row !== "object") continue;
    const r: Record<string, number | null> = {};
    let any = false;
    for (const k of Object.keys(SCOPE_LABELS)) {
      const n = (row as Record<string, unknown>)[k];
      r[k] = typeof n === "number" ? n : null;
      if (typeof n === "number") any = true;
    }
    if (any) out[cat] = r;
  }
  return out;
};

export function toConfigDetail(c: any): SensitivityDetail {
  const thin = (c.explanationWords ?? 0) < MIN_INDEXABLE_WORDS;
  return {
    ...toConfigSummary(c),
    values: cleanValues(c.values) as SensitivityDetail["values"],
    explanationHtml: c.explanation?.html ?? "",
    testing: c.testing
      ? { testedBy: c.testing.testedBy ?? null, testedAt: iso(c.testing.testedAt), deviceUsed: c.testing.deviceUsed ?? null, methodHtml: c.testing.method?.html || null, notes: c.testing.notes ?? null }
      : null,
    shareCode: c.shareCode ?? null,
    // Thin-content guard: short explanations are published but not indexed.
    seo: seo(c, thin),
  };
}

export function toDeviceSummary(d: any, configCount = 0): DeviceSummary {
  return {
    id: String(d._id),
    slug: d.slug,
    brand: d.brand,
    brandSlug: d.brandSlug,
    model: d.model,
    supportedFps: [...(d.supportedFps ?? [])].sort((a: number, b: number) => a - b),
    gyroscope: Boolean(d.gyroscope),
    configCount,
    image: toMediaRef(d.image),
  };
}

export function toDeviceDetail(d: any, configs: any[]): DeviceDetail {
  return {
    ...toDeviceSummary(d, configs.length),
    releaseYear: d.releaseYear ?? null,
    chipset: d.chipset ?? null,
    displayRefreshRateHz: d.displayRefreshRateHz ?? null,
    screenSizeInches: d.screenSizeInches ?? null,
    specSourceUrl: d.specSourceUrl ?? null,
    fpsSourceUrl: d.fpsSourceUrl ?? null,
    configs: configs.map(toConfigSummary),
    seo: seo(d, configs.length === 0),
    updatedAt: iso(d.updatedAt)!,
  };
}

export function toWeaponSummary(w: any): WeaponSummary {
  return { id: String(w._id), slug: w.slug, name: w.name, type: w.type, game: toGameRef(w.game) ?? { key: "bgmi", name: "BGMI" }, image: toMediaRef(w.image) };
}

export function toWeaponDetail(w: any): WeaponDetail {
  return {
    ...toWeaponSummary(w),
    ammo: w.ammo ?? null,
    recoilNotesHtml: w.recoilNotes?.html ?? "",
    attachmentNotesHtml: w.attachmentNotes?.html || null,
    recommendedScopes: (w.recommendedScopes ?? []).map((k: keyof typeof SCOPE_LABELS) => ({ key: k, label: SCOPE_LABELS[k] })),
    seo: seo(w),
    updatedAt: iso(w.updatedAt)!,
  };
}

export function toCodeDto(c: any): SensitivityCodeDto {
  return {
    id: String(c._id),
    code: c.code,
    device: deviceRef(c.device),
    fps: c.fps,
    gyroscope: c.gyroscope,
    testedAt: iso(c.testedAt ?? c.verifiedAt ?? c.createdAt)!,
    author: c.author,
    description: c.description ?? "",
    gameVersion: c.gameVersion ?? null,
  };
}
