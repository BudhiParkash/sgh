import type { NextConfig } from "next";

/**
 * Baseline security headers. A nonce-based Content-Security-Policy is added in M8
 * together with consent-gated analytics/ad scripts (see docs/architecture/10-security.md).
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

/**
 * Content-Security-Policy (production builds only — `next dev` needs eval).
 * A static policy (no nonce) so pages stay statically generated/ISR; inline scripts are limited to
 * Next.js bootstrapping, JSON-LD and the consent-gated GA4 snippet. Third-party origins are allowlisted.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/client https://www.googletagmanager.com https://challenges.cloudflare.com https://securepubads.g.doubleclick.net https://pagead2.googlesyndication.com",
  "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style",
  `img-src 'self' data: blob: ${process.env.NEXT_PUBLIC_MEDIA_ORIGIN ?? "https://media.shivanshigaming.com"} https://*.google-analytics.com https://*.googletagmanager.com https://*.g.doubleclick.net https://*.googlesyndication.com https://i.ytimg.com https://lh3.googleusercontent.com`,
  "font-src 'self'",
  "connect-src 'self' https://accounts.google.com/gsi/ https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://challenges.cloudflare.com https://*.g.doubleclick.net https://pagead2.googlesyndication.com",
  "frame-src https://accounts.google.com/gsi/ https://www.youtube-nocookie.com https://challenges.cloudflare.com https://*.doubleclick.net https://*.googlesyndication.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  // HTTPS is enforced by Cloudflare + HSTS (Nginx), so no upgrade-insecure-requests needed here.
].join("; ");
if (process.env.NODE_ENV === "production") securityHeaders.push({ key: "Content-Security-Policy", value: csp });

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@sgh/shared"],
  images: {
    formats: ["image/avif", "image/webp"],
  },
  /**
   * Same-origin API: in production Nginx routes /api/v1 to Express before Next sees it.
   * In development this rewrite gives the browser the same URL shape.
   */
  async rewrites() {
    const api = process.env.API_INTERNAL_URL ?? "http://localhost:4000/api/v1";
    return [
      { source: "/api/v1/:path*", destination: `${api}/:path*` },
      // Local media in development (production: https://media.shivanshigaming.com via Cloudflare → S3)
      { source: "/media/:path*", destination: `${api}/media-files/:path*` },
      // MCP server + OAuth for AI assistants (served by Express at the site root; Nginx in production).
      ...["/mcp", "/authorize", "/token", "/register", "/revoke", "/oauth/:path*", "/.well-known/oauth-authorization-server", "/.well-known/oauth-protected-resource/:path*"].map((source) => ({
        source,
        destination: `${new URL(api).origin}${source}`,
      })),
    ];
  },
  async headers() {
    const headers = [
      { source: "/:path*", headers: securityHeaders },
      // Service worker must never be cached long, or updates would be delayed.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }, { key: "Service-Worker-Allowed", value: "/" }] },
    ];
    if (process.env.SITE_ENV !== "production") {
      // Non-production deployments must never be indexed.
      headers.push({ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] });
    }
    return headers;
  },
};

export default nextConfig;
