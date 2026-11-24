import "server-only";
import type { ApiResponse, ApiMeta } from "@sgh/shared";

const API_URL = process.env.API_INTERNAL_URL ?? "http://localhost:4000/api/v1";

export interface FetchOptions {
  /** Cache tags for on-demand revalidation (see docs/architecture/01 §3.4). */
  tags?: string[];
  /** Fallback time-based revalidation in seconds. */
  revalidate?: number | false;
  searchParams?: Record<string, string | number | boolean | undefined | null>;
  /** Bypass the data cache (draft previews). */
  noStore?: boolean;
}

export interface ApiResult<T> {
  data: T;
  meta?: ApiMeta;
}

function buildUrl(path: string, params?: FetchOptions["searchParams"]): string {
  const url = new URL(`${API_URL}${path.startsWith("/") ? path : `/${path}`}`);
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  return url.toString();
}

/**
 * GET from the public API (server-side only).
 * Returns `null` when the resource is missing (404). Throws `ApiUnavailableError` when the API
 * is unreachable or errors, so callers can choose between an error state and graceful hiding.
 */
export async function apiGet<T>(path: string, opts: FetchOptions = {}): Promise<ApiResult<T> | null> {
  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.searchParams), {
      headers: { Accept: "application/json" },
      ...(opts.noStore ? { cache: "no-store" as const } : { next: { tags: opts.tags, revalidate: opts.revalidate ?? 300 } }),
      signal: AbortSignal.timeout(8000),
    });
  } catch (cause) {
    throw new ApiUnavailableError(path, cause);
  }
  if (res.status === 404) return null;
  let body: ApiResponse<T>;
  try {
    body = (await res.json()) as ApiResponse<T>;
  } catch (cause) {
    throw new ApiUnavailableError(path, cause);
  }
  if (!res.ok || !body.success) throw new ApiUnavailableError(path, body);
  return { data: body.data, meta: body.meta };
}

/** Like apiGet but never throws: logs and returns the fallback (for non-critical page sections). */
export async function apiGetOr<T>(path: string, fallback: T, opts: FetchOptions = {}): Promise<T> {
  try {
    const result = await apiGet<T>(path, opts);
    return result?.data ?? fallback;
  } catch (err) {
    // During `next build` the API is usually not running — that's expected, don't spam the log.
    if (process.env.NEXT_PHASE !== "phase-production-build") console.error(`[api] ${(err as Error).message}`);
    return fallback;
  }
}

export class ApiUnavailableError extends Error {
  constructor(path: string, cause?: unknown) {
    super(`API request failed: ${path}`, { cause });
    this.name = "ApiUnavailableError";
  }
}
