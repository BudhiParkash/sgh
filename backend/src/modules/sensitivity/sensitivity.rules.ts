import { SCOPE_KEYS, SENSITIVITY_CATEGORIES, SENSITIVITY_RANGES, type GyroMode, type Playstyle, type SensitivityCategory } from "@sgh/shared";

type Values = Partial<Record<SensitivityCategory, Partial<Record<string, number | null>> | null>>;

/** Which categories must be filled for a gyroscope mode. */
export function requiredCategories(gyro: GyroMode): SensitivityCategory[] {
  return gyro === "off" ? ["camera", "ads"] : ["camera", "ads", "gyro", "ads_gyro"];
}

/** Validates the values grid: required categories complete, every value within the in-game range. */
export function valueViolations(values: Values | undefined, gyro: GyroMode): { path: string; message: string }[] {
  const out: { path: string; message: string }[] = [];
  for (const cat of SENSITIVITY_CATEGORIES) {
    const row = values?.[cat] ?? null;
    const required = requiredCategories(gyro).includes(cat);
    const { min, max } = SENSITIVITY_RANGES[cat];
    for (const scope of SCOPE_KEYS) {
      const v = row?.[scope];
      if (v === undefined || v === null) {
        if (required) out.push({ path: `values.${cat}.${scope}`, message: "Required" });
        continue;
      }
      if (!Number.isInteger(v) || v < min || v > max) out.push({ path: `values.${cat}.${scope}`, message: `Must be a whole number from ${min} to ${max}` });
    }
  }
  return out;
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** A configuration claimed as "tested" must say who tested it, where, on which game version and when. */
export function provenanceViolations(c: { provenance: string; gameVersion?: string | null; testing?: { testedBy?: string | null; testedAt?: Date | string | null; deviceUsed?: string | null } | null }): string[] {
  if (c.provenance !== "tested") return [];
  const missing: string[] = [];
  if (!c.testing?.testedBy) missing.push("tester name");
  if (!c.testing?.testedAt) missing.push("test date");
  if (!c.testing?.deviceUsed) missing.push("device used");
  if (!c.gameVersion) missing.push("game version");
  return missing.length ? [`"Tested" setups must record the ${missing.join(", ")}.`] : [];
}

export interface Want {
  fps: number;
  gyroscope: GyroMode;
  playstyle: Playstyle;
}
export interface Candidate extends Want {
  id: string;
}

/** Lower is better. 0 = exact match on fps, gyro mode and playstyle. */
export function matchScore(c: Want, want: Want): number {
  return Math.abs(c.fps - want.fps) / 30 * 10 + (c.gyroscope === want.gyroscope ? 0 : c.gyroscope === "off" || want.gyroscope === "off" ? 30 : 8) + (c.playstyle === want.playstyle ? 0 : 5);
}

export function rank<T extends Want>(candidates: T[], want: Want): T[] {
  return [...candidates].sort((a, b) => matchScore(a, want) - matchScore(b, want));
}
