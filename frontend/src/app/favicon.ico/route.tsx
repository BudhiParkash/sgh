import { ImageResponse } from "next/og";

export const dynamic = "force-static";

/** Browsers still request /favicon.ico; serve a 32×32 PNG of the mark. */
export function GET() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex" }}>
        <svg width="32" height="32" viewBox="0 0 64 64">
          <path d="M32 4.5 55.8 18.25v27.5L32 59.5 8.2 45.75v-27.5Z" fill="#0F1016" stroke="#8B5CF6" strokeWidth="4" />
          <path d="M43.5 20.5H26.2l-5 5.6 4.6 5.4h12.8l4.6 5.4-5 5.6H30" fill="none" stroke="#A78BFA" strokeWidth="6" />
          <path d="M25 42.5h-5" stroke="#22D3EE" strokeWidth="6" />
        </svg>
      </div>
    ),
    { width: 32, height: 32 },
  );
}
