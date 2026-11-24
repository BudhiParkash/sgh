"use client";

import { useSyncExternalStore } from "react";
import { REDUCE_EFFECTS_KEY } from "@/components/3d/use-render-tier";

const EVENT = "sgh:effects-changed";

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

function read(): boolean {
  try {
    return window.localStorage.getItem(REDUCE_EFFECTS_KEY) === "1";
  } catch {
    return false;
  }
}

/** Footer switch letting any visitor turn off 3D effects (saved on this device only). */
export function ReduceEffectsToggle() {
  const on = useSyncExternalStore(subscribe, read, () => false);
  const toggle = () => {
    try {
      window.localStorage.setItem(REDUCE_EFFECTS_KEY, on ? "0" : "1");
    } catch {
      /* storage unavailable — preference can't persist */
    }
    window.dispatchEvent(new Event(EVENT));
  };
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={toggle}
      className="inline-flex min-h-11 items-center gap-2 text-xs text-subtle hover:text-text"
    >
      <span className={`relative h-5 w-9 rounded-full transition-colors ${on ? "bg-primary-solid" : "bg-surface-3"}`} aria-hidden="true">
        <span className={`absolute top-0.5 size-4 rounded-full bg-white transition-transform ${on ? "translate-x-4.5" : "translate-x-0.5"}`} />
      </span>
      Reduce 3D effects
    </button>
  );
}
