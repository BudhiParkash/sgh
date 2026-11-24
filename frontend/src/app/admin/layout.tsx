import type { Metadata } from "next";
import { AdminProviders } from "@/lib/admin/context";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · SGH Admin" },
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <AdminProviders>{children}</AdminProviders>;
}
