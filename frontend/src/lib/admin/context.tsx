"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { ApiError, adminFetch, setCsrfToken } from "./api";
import { ToastProvider } from "./toast";

export interface Me {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
  twoFactorEnabled: boolean;
  mustSetup2fa: boolean;
  csrfToken: string;
}

interface AdminCtx {
  me: Me;
  can: (perm: string) => boolean;
}

const Ctx = createContext<AdminCtx | null>(null);

export function useAdmin(): AdminCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAdmin outside AdminSession");
  return c;
}

export function AdminProviders({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 15_000, retry: (n, e) => !(e instanceof ApiError && e.status < 500) && n < 2, refetchOnWindowFocus: false },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}

export function useMeQuery() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const r = await adminFetch<Me>("/auth/me");
      setCsrfToken(r.data.csrfToken);
      return r.data;
    },
    retry: false,
  });
}

/** Guards protected admin pages: redirects to login / 2FA setup as needed. */
export function AdminSession({ children, fallback }: { children: React.ReactNode; fallback: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const me = useMeQuery();

  useEffect(() => {
    const onUnauth = () => router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`);
    window.addEventListener("sgh:unauthenticated", onUnauth);
    return () => window.removeEventListener("sgh:unauthenticated", onUnauth);
  }, [router, pathname]);

  useEffect(() => {
    if (me.error instanceof ApiError && me.error.status === 401) router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`);
    else if (me.data?.mustSetup2fa) router.replace("/admin/setup-2fa");
  }, [me.error, me.data, router, pathname]);

  const value = useMemo<AdminCtx | null>(() => (me.data ? { me: me.data, can: (p) => me.data.permissions.includes(p) } : null), [me.data]);
  if (!value || value.me.mustSetup2fa) return <>{fallback}</>;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
