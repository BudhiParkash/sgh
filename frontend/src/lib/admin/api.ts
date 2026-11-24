"use client";

import type { ApiErrorBody, ApiMeta } from "@sgh/shared";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: { path: string; message: string }[] = [],
    public requestId?: string,
  ) {
    super(message);
  }
}

let csrfToken = "";
export const setCsrfToken = (t: string) => {
  csrfToken = t;
};

export interface Paged<T> {
  data: T;
  meta?: ApiMeta;
}

interface Options {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  form?: FormData;
  ifMatch?: number;
  query?: Record<string, string | number | boolean | undefined | null>;
}

/** Same-origin admin API client: session cookie + CSRF header; normalises the error envelope. */
export async function adminFetch<T>(path: string, opts: Options = {}): Promise<Paged<T>> {
  const url = new URL(`/api/v1/admin${path}`, window.location.origin);
  for (const [k, v] of Object.entries(opts.query ?? {})) if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.method && opts.method !== "GET") headers["X-CSRF-Token"] = csrfToken;
  if (opts.ifMatch !== undefined) headers["If-Match"] = String(opts.ifMatch);
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  const res = await fetch(url, { method: opts.method ?? "GET", headers, body, credentials: "same-origin", cache: "no-store" });
  if (res.status === 204) return { data: undefined as T };
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new ApiError(res.status, "INTERNAL", "Unexpected response from the server.");
  }
  if (!res.ok || !(json as { success?: boolean }).success) {
    const e = (json as ApiErrorBody).error ?? { code: "INTERNAL", message: "Request failed." };
    if (res.status === 401 && !path.startsWith("/auth/login") && !path.startsWith("/auth/2fa/verify")) {
      window.dispatchEvent(new CustomEvent("sgh:unauthenticated"));
    }
    throw new ApiError(res.status, e.code, e.message, e.details, e.requestId);
  }
  return json as Paged<T>;
}

/** Maps API field errors onto react-hook-form fields. Returns true if any field error was applied. */
export function applyFieldErrors(err: unknown, setError: (name: string, e: { message: string }) => void): boolean {
  if (!(err instanceof ApiError) || err.details.length === 0) return false;
  let applied = false;
  for (const d of err.details) {
    if (d.path && d.path !== "body" && d.path !== "publish") {
      setError(d.path, { message: d.message });
      applied = true;
    }
  }
  return applied;
}
