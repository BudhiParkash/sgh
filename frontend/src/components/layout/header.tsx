"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { mainNav } from "@/lib/site";
import { cn } from "@/lib/utils";
import { MobileNav } from "./mobile-nav";
import { SavedLink } from "@/components/retention/saved-link";
import { NavLink } from "./nav-link";
import { AccountButton } from "@/components/play/account-button";

/**
 * Sticky glass header. Hides while scrolling down and reappears on scroll up
 * (saves vertical space on phones); always visible near the top and for keyboard focus.
 */
export function Header() {
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        setScrolled(y > 8);
        setHidden(y > 240 && y > lastY.current + 4);
        if (y < lastY.current - 4 || y <= 240) setHidden(false);
        lastY.current = y;
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      onFocusCapture={() => setHidden(false)}
      className={cn(
        "sticky top-0 z-40 h-[var(--header-h)] border-b transition-[transform,background-color,border-color] duration-[var(--dur-slow)] ease-[var(--ease-out)]",
        scrolled ? "glass border-border" : "border-transparent bg-transparent",
        hidden && "-translate-y-full",
      )}
    >
      <Container className="flex h-full items-center justify-between gap-4">
        <Link href="/" className="rounded-md">
          <Logo />
        </Link>

        <nav aria-label="Main" className="hidden min-[1180px]:block">
          <ul className="flex items-center gap-0.5">
            {mainNav.filter((item) => item.desktop !== false).map((item) => (
              <li key={item.href}>
                <NavLink href={item.href} className="px-2.5 py-2 whitespace-nowrap">
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <SavedLink />
          <Button asChild variant="ghost" size="icon">
            <Link href="/search" aria-label="Search"><Search className="size-5" aria-hidden="true" /></Link>
          </Button>
          <AccountButton />
          <MobileNav />
        </div>
      </Container>
    </header>
  );
}
