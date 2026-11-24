import { useId } from "react";
import { cn } from "@/lib/utils";

/** The original SGH hex mark. Decorative by default; pass `title` when it stands alone. */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  const gid = useId();
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("size-9 shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <linearGradient id={gid} x1="8" y1="4" x2="56" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#A78BFA" />
          <stop offset="0.55" stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#3B82F6" />
        </linearGradient>
      </defs>
      <path
        d="M32 4.5 55.8 18.25v27.5L32 59.5 8.2 45.75v-27.5Z"
        fill="#0F1016"
        stroke={`url(#${gid})`}
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      <path
        d="M43.5 20.5H26.2l-5 5.6 4.6 5.4h12.8l4.6 5.4-5 5.6H30"
        fill="none"
        stroke={`url(#${gid})`}
        strokeWidth="5"
        strokeLinecap="square"
      />
      <path d="M25 42.5h-5" stroke="#22D3EE" strokeWidth="5" strokeLinecap="square" />
    </svg>
  );
}

/** Mark + live-text wordmark (text stays crisp, selectable and indexable). */
export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="flex flex-col leading-none">
        <span className="font-display text-[1.05rem] font-bold tracking-[0.06em] text-text">SHIVANSHI</span>{" "}
        {!compact && (
          <span className="mt-1 font-display text-[0.62rem] font-medium tracking-[0.42em] text-muted">
            GAMING HUB
          </span>
        )}
      </span>
    </span>
  );
}
