import { ImageResponse } from "next/og";
import { CATEGORY_LABELS, SCOPE_KEYS, SCOPE_LABELS, SENSITIVITY_CATEGORIES, type SensitivityDetail } from "@sgh/shared";
import { apiGet } from "@/lib/api/server";
import { gyroLabel, provenanceLabel } from "@/lib/format";
import { siteConfig } from "@/lib/site";

export const revalidate = 86400;

/**
 * Downloadable 1080×1350 sensitivity card (Satori). Original branding + watermark + site URL.
 * Cached per values version (?v=N) — a new version produces a new URL.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return new Response("Not found", { status: 404 });
  const r = await apiGet<SensitivityDetail>(`/sensitivity/${slug}`, { tags: ["sensitivity", `sensitivity:${slug}`], revalidate: 3600 }).catch(() => null);
  if (!r) return new Response("Not found", { status: 404 });
  const c = r.data;
  const cats = SENSITIVITY_CATEGORIES.filter((k) => c.values[k]);
  const host = new URL(siteConfig.url).host;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#07070b", color: "#ecedf3", padding: 64, fontFamily: "sans-serif", position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, display: "flex", background: "radial-gradient(60% 40% at 80% 10%, rgba(139,92,246,0.35), transparent 70%)" }} />
        <div style={{ position: "absolute", right: -60, bottom: 160, fontSize: 220, fontWeight: 800, color: "rgba(255,255,255,0.035)", transform: "rotate(-18deg)", display: "flex" }}>SHIVANSHI</div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="72" height="72" viewBox="0 0 64 64">
            <path d="M32 4.5 55.8 18.25v27.5L32 59.5 8.2 45.75v-27.5Z" fill="#0F1016" stroke="#8B5CF6" strokeWidth="3.5" />
            <path d="M43.5 20.5H26.2l-5 5.6 4.6 5.4h12.8l4.6 5.4-5 5.6H30" fill="none" stroke="#A78BFA" strokeWidth="5" />
            <path d="M25 42.5h-5" stroke="#22D3EE" strokeWidth="5" />
          </svg>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: 2 }}>SHIVANSHI</span>
            <span style={{ fontSize: 16, letterSpacing: 10, color: "#9a9db0" }}>GAMING HUB</span>
          </div>
          <span style={{ marginLeft: "auto", fontSize: 22, padding: "8px 18px", borderRadius: 999, border: "2px solid #8b5cf6", color: "#c4b5fd" }}>{provenanceLabel[c.provenance]}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 44 }}>
          <span style={{ fontSize: 46, fontWeight: 800, lineHeight: 1.1 }}>{c.device ? `${c.device.brand} ${c.device.model}` : "Baseline setup"}</span>
          <span style={{ fontSize: 26, color: "#9a9db0", marginTop: 12 }}>{`${c.game.name} · ${c.fps} FPS · ${gyroLabel[c.gyroscope]} · ${c.playstyle}${c.gameVersion ? ` · v${c.gameVersion}` : ""}`}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 40, borderRadius: 24, border: "2px solid rgba(255,255,255,0.1)", background: "rgba(22,24,35,0.85)", padding: 28 }}>
          <div style={{ display: "flex", fontSize: 20, color: "#9a9db0", paddingBottom: 12, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
            <span style={{ width: 300 }}>Scope</span>
            {cats.map((k) => <span key={k} style={{ flex: 1, textAlign: "right" }}>{CATEGORY_LABELS[k].split(" (")[0]}</span>)}
          </div>
          {SCOPE_KEYS.map((s) => (
            <div key={s} style={{ display: "flex", fontSize: 28, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <span style={{ width: 300, color: "#c9cbd8", fontSize: 24 }}>{SCOPE_LABELS[s]}</span>
              {cats.map((k) => <span key={k} style={{ flex: 1, textAlign: "right", fontWeight: 700 }}>{String(c.values[k]?.[s] ?? "—")}</span>)}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", marginTop: "auto", justifyContent: "space-between", alignItems: "center", fontSize: 22, color: "#9a9db0" }}>
          <span>{c.testing?.testedBy ? `Tested by ${c.testing.testedBy}` : "Fine-tune in the training ground"}</span>
          <span style={{ color: "#22d3ee" }}>{`${host}/sensitivity/${c.slug}`.slice(0, 60)}</span>
        </div>
        <span style={{ fontSize: 15, color: "#6e7187", marginTop: 14, display: "flex" }}>Independent fan platform — not affiliated with KRAFTON or Tencent Games.</span>
      </div>
    ),
    { width: 1080, height: 1350, headers: { "Cache-Control": "public, max-age=86400, s-maxage=31536000, immutable" } },
  );
}
