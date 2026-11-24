"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink, LogOut, Menu } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger, SheetContent } from "@/components/ui/dialog";
import { adminFetch } from "@/lib/admin/api";
import { useAdmin } from "@/lib/admin/context";
import { cn } from "@/lib/utils";
import { ADMIN_NAV } from "./nav";
import { isAvailable } from "./registry-keys";

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { can } = useAdmin();
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="flex flex-col gap-5 p-3">
      {ADMIN_NAV.map((g) => {
        const items = g.items.filter((i) => can(i.perm) && isAvailable(i.href));
        if (!items.length) return null;
        return (
          <div key={g.group}>
            <p className="mb-1 px-3 text-[0.68rem] font-semibold tracking-[0.18em] text-subtle uppercase">{g.group}</p>
            <ul>
              {items.map((i) => {
                const active = i.href === "/admin" ? pathname === "/admin" : pathname === i.href || pathname.startsWith(`${i.href}/`);
                return (
                  <li key={i.href}>
                    <Link
                      href={i.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn("flex min-h-10 items-center gap-3 rounded-md px-3 text-sm", active ? "bg-surface-3 text-text" : "text-muted hover:bg-surface-2 hover:text-text")}
                    >
                      <i.icon className="size-4 shrink-0" aria-hidden="true" />
                      {i.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { me } = useAdmin();
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const logout = async () => {
    await adminFetch("/auth/logout", { method: "POST" }).catch(() => undefined);
    qc.clear();
    router.replace("/admin/login");
  };
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 hidden h-dvh overflow-y-auto border-r border-border bg-surface-1 lg:block">
        <Link href="/admin" className="flex h-16 items-center gap-2.5 border-b border-border px-5">
          <LogoMark className="size-8" />
          <span className="font-display font-bold tracking-wide">SGH Admin</span>
        </Link>
        <NavList />
      </aside>
      <div className="min-w-0">
        <header className="glass sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border px-4 md:px-6">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open admin menu">
                <Menu aria-hidden="true" />
              </Button>
            </DialogTrigger>
            <SheetContent title="Admin menu" className="right-auto left-0 border-r border-l-0">
              <NavList onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Dialog>
          <div className="ml-auto flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <a href="/" target="_blank" rel="noopener noreferrer">View site <ExternalLink aria-hidden="true" /></a>
            </Button>
            <div className="hidden text-right sm:block">
              <p className="text-sm leading-tight font-medium">{me.name}</p>
              <p className="text-xs text-subtle capitalize">{me.role.replace(/_/g, " ")}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={logout} aria-label="Sign out">
              <LogOut aria-hidden="true" />
            </Button>
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-[1400px] p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
