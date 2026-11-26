import { cn } from "@/lib/utils";

export interface MediaImageRef {
  url: string;
  alt: string;
  width?: number;
  height?: number;
  /** Responsive WebP variants built by the API ("url 320w, url 640w, …"). */
  srcSet?: string;
}

/**
 * Image from our media library. The API already stores resized WebP/AVIF variants, so this renders a plain
 * responsive <img> instead of going through Next's image optimiser (which rejects hosts it isn't configured for —
 * that is why card images used to break while detail pages worked).
 * `fill` positions it like next/image's fill: the parent must be `relative` with a size/aspect ratio.
 */
export function MediaImage({
  image,
  sizes,
  fill,
  priority,
  className,
}: {
  image: MediaImageRef;
  sizes?: string;
  fill?: boolean;
  priority?: boolean;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- variants are pre-built by the media pipeline
    <img
      src={image.url}
      srcSet={image.srcSet || undefined}
      sizes={image.srcSet ? sizes : undefined}
      alt={image.alt}
      width={fill ? undefined : image.width || undefined}
      height={fill ? undefined : image.height || undefined}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      className={cn(fill && "absolute inset-0 size-full", className)}
    />
  );
}
