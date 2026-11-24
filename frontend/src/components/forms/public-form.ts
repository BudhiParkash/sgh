"use client";

export interface PostResult<T> {
  ok: boolean;
  data?: T;
  message?: string;
  fieldErrors: Record<string, string>;
}

/** POST to a public API endpoint and normalise the error envelope for forms. */
export async function postPublic<T>(path: string, body: unknown): Promise<PostResult<T>> {
  try {
    const res = await fetch(`/api/v1${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = (await res.json()) as { data?: T; error?: { message?: string; details?: { path: string; message: string }[] } };
    if (!res.ok) {
      return {
        ok: false,
        message: res.status === 429 ? "Too many submissions — please try again later." : (json.error?.message ?? "Something went wrong."),
        fieldErrors: Object.fromEntries((json.error?.details ?? []).map((d) => [d.path, d.message])),
      };
    }
    return { ok: true, data: json.data, fieldErrors: {} };
  } catch {
    return { ok: false, message: "Network error — please check your connection and try again.", fieldErrors: {} };
  }
}
