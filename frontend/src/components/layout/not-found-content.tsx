import Link from "next/link";
import { Button } from "@/components/ui/button";

const LINKS = [
  { href: "/tournaments", label: "Tournaments" },
  { href: "/custom-rooms", label: "Custom Rooms" },
  { href: "/sensitivity", label: "Sensitivity" },
  { href: "/guides", label: "Gaming Guides" },
  { href: "/search", label: "Search" },
];

/** 404 message only — the surrounding layout provides the header and footer. */
export function NotFoundContent() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-4 py-24 text-center">
      <p className="font-mono text-sm text-accent">404</p>
      <h1 className="text-display font-bold">Page not found</h1>
      <p className="max-w-md text-muted">This page doesn&apos;t exist, has moved, or isn&apos;t published yet. Try one of these instead:</p>
      <nav aria-label="Popular pages">
        <ul className="flex flex-wrap justify-center gap-2">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Button asChild variant="secondary" size="sm">
                <Link href={l.href}>{l.label}</Link>
              </Button>
            </li>
          ))}
        </ul>
      </nav>
      <Button asChild>
        <Link href="/">Back to home</Link>
      </Button>
    </div>
  );
}
