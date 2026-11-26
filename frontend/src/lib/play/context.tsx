"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { playerFetch, setPlayerCsrf } from "./client";
import type { Me } from "./types";

/** A non-secret hint (the session cookie itself is httpOnly) so signed-out visitors don't call /me on every page. */
const HINT = "sgh_player";
const readHint = () => {
  try {
    return localStorage.getItem(HINT) === "1";
  } catch {
    return false;
  }
};
const writeHint = (on: boolean) => {
  try {
    if (on) localStorage.setItem(HINT, "1");
    else localStorage.removeItem(HINT);
  } catch {
    /* private mode */
  }
};

interface PlayerCtx {
  me: Me | null;
  ready: boolean;
  /** Called after a successful Google sign-in. */
  signedIn: (me: Me) => void;
  refresh: () => Promise<void>;
  setCoins: (coins: number) => void;
  signOut: () => Promise<void>;
  signInOpen: boolean;
  openSignIn: (reason?: string) => void;
  closeSignIn: () => void;
  signInReason: string | null;
}

const Ctx = createContext<PlayerCtx | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [signInReason, setReason] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const m = await playerFetch<Me>("/me");
      if (m.csrfToken) setPlayerCsrf(m.csrfToken);
      setMe(m);
      writeHint(true);
    } catch {
      setMe(null);
      writeHint(false);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    // Deferred so the first paint never waits for the session check.
    const id = setTimeout(() => {
      if (readHint()) void refresh();
      else setReady(true);
    }, 0);
    const onOut = () => {
      setMe(null);
      writeHint(false);
    };
    window.addEventListener("sgh:player-signed-out", onOut);
    return () => {
      clearTimeout(id);
      window.removeEventListener("sgh:player-signed-out", onOut);
    };
  }, [refresh]);

  const value = useMemo<PlayerCtx>(
    () => ({
      me,
      ready,
      signedIn: (m) => {
        if (m.csrfToken) setPlayerCsrf(m.csrfToken);
        setMe(m);
        setReady(true);
        writeHint(true);
        setSignInOpen(false);
      },
      refresh,
      setCoins: (coins) => setMe((m) => (m ? { ...m, coins } : m)),
      signOut: async () => {
        await playerFetch("/auth/logout", { method: "POST" }).catch(() => undefined);
        setMe(null);
        writeHint(false);
      },
      signInOpen,
      openSignIn: (reason) => {
        setReason(reason ?? null);
        setSignInOpen(true);
      },
      closeSignIn: () => setSignInOpen(false),
      signInReason,
    }),
    [me, ready, refresh, signInOpen, signInReason],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Used where the header renders outside the site layout (e.g. the root not-found page): behaves as signed out. */
const FALLBACK: PlayerCtx = {
  me: null,
  ready: true,
  signedIn: () => undefined,
  refresh: async () => undefined,
  setCoins: () => undefined,
  signOut: async () => undefined,
  signInOpen: false,
  openSignIn: () => {
    window.location.assign("/account");
  },
  closeSignIn: () => undefined,
  signInReason: null,
};

export function usePlayer(): PlayerCtx {
  return useContext(Ctx) ?? FALLBACK;
}
