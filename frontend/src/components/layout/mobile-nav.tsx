"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Dialog, DialogTrigger, SheetContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { mainNav } from "@/lib/site";
import { cn } from "@/lib/utils";
import { isActivePath } from "./nav-link";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
          <Menu className="size-6" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <SheetContent title="Menu">
        <nav aria-label="Mobile">
          <ul className="flex flex-col p-2">
            {mainNav.map((item) => {
              const active = isActivePath(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-12 items-center rounded-md px-4 text-base font-medium",
                      active ? "bg-surface-2 text-text" : "text-muted hover:bg-surface-2 hover:text-text",
                    )}
                  >
                    {active && <span className="mr-3 h-5 w-1 rounded-full bg-primary" aria-hidden="true" />}
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-border p-4">
            <Button asChild fullWidth>
              <Link href="/sensitivity" onClick={() => setOpen(false)}>
                Find Your Sensitivity
              </Link>
            </Button>
          </div>
        </nav>
      </SheetContent>
    </Dialog>
  );
}
