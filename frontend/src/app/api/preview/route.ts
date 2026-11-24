import { draftMode } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

/**
 * Enables Next.js draft mode for an admin preview link. The signed token is stored in a cookie and
 * verified by the API when the page fetches the unpublished item; an invalid token simply shows nothing.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const path = req.nextUrl.searchParams.get("path") ?? "/";
  if (!/^[\w-]+\.[\w-]+$/.test(token) || !path.startsWith("/") || path.startsWith("//")) return new Response("Invalid preview link", { status: 400 });
  (await draftMode()).enable();
  const { cookies } = await import("next/headers");
  (await cookies()).set("sgh_preview", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 1800 });
  redirect(path);
}
