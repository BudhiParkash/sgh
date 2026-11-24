"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface NavLinkProps extends React.ComponentProps<typeof Link> {
  href: string;
}

export function NavLink({ href, className, children, ...props }: NavLinkProps) {
  const pathname = usePathname();
  const active = isActivePath(pathname, href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative rounded-md text-sm font-medium transition-colors duration-[var(--dur-fast)]",
        active ? "text-text" : "text-muted hover:text-text",
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
