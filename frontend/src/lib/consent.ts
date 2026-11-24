export const CONSENT_COOKIE = "sgh_consent";
/** Bump when categories or the cookie policy change materially → visitors are asked again. */
export const CONSENT_VERSION = 1;

export interface Consent {
  v: number;
  analytics: boolean;
  ads: boolean;
  ts: number;
}

export function readConsent(): Consent | null {
  if (typeof document === "undefined") return null;
  const raw = document.cookie.split("; ").find((c) => c.startsWith(`${CONSENT_COOKIE}=`))?.slice(CONSENT_COOKIE.length + 1);
  if (!raw) return null;
  try {
    const c = JSON.parse(decodeURIComponent(raw)) as Consent;
    return c.v === CONSENT_VERSION ? c : null;
  } catch {
    return null;
  }
}

export function writeConsent(c: Omit<Consent, "v" | "ts">): Consent {
  const full: Consent = { v: CONSENT_VERSION, ts: Date.now(), ...c };
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(full))}; Max-Age=${60 * 60 * 24 * 365}; Path=/; SameSite=Lax${secure}`;
  window.dispatchEvent(new CustomEvent("sgh:consent", { detail: full }));
  return full;
}
