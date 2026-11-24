import { ImageResponse } from "next/og";

export const dynamic = "force-static";
export function generateStaticParams() {
  return [{ size: "192" }, { size: "512" }, { size: "maskable-512" }, { size: "apple-180" }];
}

/** PNG app icons for Android/iOS install (generated from the SVG mark). */
export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const px = size === "192" ? 192 : size === "apple-180" ? 180 : 512;
  const maskable = size.startsWith("maskable") || size.startsWith("apple");
  const mark = maskable ? px * 0.62 : px * 0.9;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: maskable ? "#07070b" : "transparent" }}>
        <svg width={mark} height={mark} viewBox="0 0 64 64">
          <path d="M32 4.5 55.8 18.25v27.5L32 59.5 8.2 45.75v-27.5Z" fill="#0F1016" stroke="#8B5CF6" strokeWidth="3.5" strokeLinejoin="round" />
          <path d="M43.5 20.5H26.2l-5 5.6 4.6 5.4h12.8l4.6 5.4-5 5.6H30" fill="none" stroke="#A78BFA" strokeWidth="5" />
          <path d="M25 42.5h-5" stroke="#22D3EE" strokeWidth="5" />
        </svg>
      </div>
    ),
    { width: px, height: px },
  );
}
