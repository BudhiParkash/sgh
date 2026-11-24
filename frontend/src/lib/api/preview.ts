import "server-only";
import { cookies, draftMode } from "next/headers";
import { apiGet } from "./server";

/**
 * In draft mode (enabled from the admin "Preview" button) returns the unpublished item for this
 * entity if the signed token is valid; otherwise null. Never cached.
 */
export async function getPreviewItem<T>(entity: string): Promise<T | null> {
  if (!(await draftMode()).isEnabled) return null;
  const token = (await cookies()).get("sgh_preview")?.value;
  if (!token || !/^[\w-]+\.[\w-]+$/.test(token)) return null;
  try {
    const r = await apiGet<{ entity: string; item: T }>(`/preview/${token}`, { noStore: true });
    return r && r.data.entity === entity ? r.data.item : null;
  } catch {
    return null;
  }
}
