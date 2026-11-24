"use client";

import { AdminShell } from "@/components/admin/shell";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminSession } from "@/lib/admin/context";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminSession
      fallback={
        <div className="grid min-h-dvh place-items-center p-6" aria-busy="true">
          <Skeleton className="h-10 w-48" />
        </div>
      }
    >
      <AdminShell>{children}</AdminShell>
    </AdminSession>
  );
}
