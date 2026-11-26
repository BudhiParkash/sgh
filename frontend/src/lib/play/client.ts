"use client";

/** Same-origin client for /api/v1/player (player session cookie + CSRF header). */
export class PlayerError extends Error {
  constructor(
    public status: number,
    message: string,
    public details: { path: string; message: string }[] = [],
  ) {
    super(message);
  }
}

let csrf = "";
export const setPlayerCsrf = (t: string) => {
  csrf = t;
};

export async function playerFetch<T>(path: string, opts: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.method && opts.method !== "GET") headers["X-CSRF-Token"] = csrf;
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`/api/v1/player${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    credentials: "same-origin",
    cache: "no-store",
  });
  if (res.status === 204) return undefined as T;
  let json: { success?: boolean; data?: T; error?: { message?: string; details?: { path: string; message: string }[] } } = {};
  try {
    json = await res.json();
  } catch {
    throw new PlayerError(res.status, "Unexpected response from the server.");
  }
  if (!res.ok || !json.success) {
    if (res.status === 401) window.dispatchEvent(new CustomEvent("sgh:player-signed-out"));
    throw new PlayerError(res.status, json.error?.details?.[0]?.message ?? json.error?.message ?? "Something went wrong.", json.error?.details);
  }
  return json.data as T;
}

/** Public (no session) GET from the browser. */
export async function publicFetch<T>(path: string): Promise<T> {
  const res = await fetch(`/api/v1${path}`, { headers: { Accept: "application/json" }, cache: "no-store" });
  const json = (await res.json()) as { success?: boolean; data?: T; error?: { message?: string } };
  if (!res.ok || !json.success) throw new PlayerError(res.status, json.error?.message ?? "Request failed.");
  return json.data as T;
}

export const errorText = (e: unknown) => (e instanceof PlayerError ? e.message : "Something went wrong. Please try again.");
