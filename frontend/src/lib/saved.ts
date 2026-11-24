"use client";

import { useSyncExternalStore } from "react";

/**
 * Favourites stored only on the visitor's device (localStorage) — no account, nothing sent to us.
 * Shared across tabs via the `storage` event.
 */
export interface SavedSetup {
  kind: "setup";
  slug: string;
  title: string;
  fps: number;
  gyroscope: string;
  device: string | null;
  savedAt: number;
}
export interface SavedTournament {
  kind: "tournament";
  slug: string;
  name: string;
  game: string;
  startDate: string | null;
  endDate: string | null;
  registrationDeadline: string | null;
  savedAt: number;
}
export type SavedItem = SavedSetup | SavedTournament;

const KEY = "sgh-saved-v1";
const EVENT = "sgh:saved";
const EMPTY: SavedItem[] = [];
let cacheRaw: string | null = null;
let cacheVal: SavedItem[] = EMPTY;

function read(): SavedItem[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === cacheRaw) return cacheVal;
    cacheRaw = raw;
    cacheVal = raw ? (JSON.parse(raw) as SavedItem[]) : EMPTY;
    return cacheVal;
  } catch {
    return EMPTY;
  }
}

function write(items: SavedItem[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items.slice(0, 200)));
  } catch {
    /* storage full or blocked — favourites simply won't persist */
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useSaved(): SavedItem[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function isSaved(items: SavedItem[], kind: SavedItem["kind"], slug: string) {
  return items.some((i) => i.kind === kind && i.slug === slug);
}

export function toggleSaved(item: SavedItem): boolean {
  const items = read();
  const exists = isSaved(items, item.kind, item.slug);
  write(exists ? items.filter((i) => !(i.kind === item.kind && i.slug === item.slug)) : [item, ...items]);
  return !exists;
}

export function removeSaved(kind: SavedItem["kind"], slug: string) {
  write(read().filter((i) => !(i.kind === kind && i.slug === slug)));
}
