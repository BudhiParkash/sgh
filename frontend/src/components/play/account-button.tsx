"use client";

import Link from "next/link";
import { Coins, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlayer } from "@/lib/play/context";

/** Header control: "Sign in" for visitors, coin balance + avatar for players. */
export function AccountButton() {
  const { me, ready, openSignIn } = usePlayer();
  if (!ready) return <span className="hidden h-9 w-20 sm:block" aria-hidden="true" />;
  if (!me) {
    return (
      <Button variant="secondary" size="sm" onClick={() => openSignIn()} className="hidden sm:inline-flex">
        <UserRound aria-hidden="true" /> Sign in
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <Link href="/rewards" className="flex h-9 items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 text-sm font-semibold text-accent" aria-label={`${me.coins} SGC coins — open rewards`}>
        <Coins className="size-4" aria-hidden="true" />
        {me.coins.toLocaleString("en-IN")}
      </Link>
      <Link href="/account" className="flex size-10 items-center justify-center overflow-hidden rounded-full border border-border-strong bg-surface-2" aria-label="Your account">
        {me.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Google avatar, small and already optimised
          <img src={me.avatarUrl} alt="" width={40} height={40} referrerPolicy="no-referrer" className="size-full object-cover" />
        ) : (
          <UserRound className="size-5 text-muted" aria-hidden="true" />
        )}
      </Link>
    </div>
  );
}
