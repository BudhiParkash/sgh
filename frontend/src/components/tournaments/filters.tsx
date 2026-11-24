"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";

/** Game + search filters (URL-driven, so results are shareable; filtered views are noindex). */
export function TournamentFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const apply = (next: Record<string, string>) => {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    sp.delete("page");
    router.push(`${pathname}${sp.size ? `?${sp}` : ""}`);
  };
  return (
    <form
      role="search"
      className="flex flex-col gap-3 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        apply({ q: q.trim() });
      }}
    >
      <div className="sm:w-48">
        <Select aria-label="Game" value={params.get("game") ?? ""} onChange={(e) => apply({ game: e.target.value })}>
          <option value="">All games</option>
          <option value="bgmi">BGMI</option>
          <option value="pubg-mobile">PUBG Mobile</option>
        </Select>
      </div>
      <div className="flex flex-1 gap-2">
        <Input type="search" aria-label="Search tournaments" placeholder="Search by name or organiser" value={q} onChange={(e) => setQ(e.target.value)} className="sm:max-w-sm" />
        <Button type="submit" variant="secondary" size="icon" aria-label="Search"><Search aria-hidden="true" /></Button>
      </div>
    </form>
  );
}
