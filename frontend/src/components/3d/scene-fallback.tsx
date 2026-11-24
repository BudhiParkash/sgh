import Image from "next/image";
import { cn } from "@/lib/utils";

/** Static poster shown on the server, on first paint, and whenever 3D is not rendered. Decorative. */
export function SceneFallback({ src, className, priority = false }: { src: string; className?: string; priority?: boolean }) {
  return (
    <Image
      src={src}
      alt=""
      aria-hidden="true"
      fill
      priority={priority}
      fetchPriority={priority ? "high" : undefined}
      loading={priority ? "eager" : "lazy"}
      unoptimized
      sizes="(min-width: 1024px) 55vw, 100vw"
      className={cn("pointer-events-none object-contain select-none", className)}
    />
  );
}
