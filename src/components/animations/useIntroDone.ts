"use client";

import { useSyncExternalStore } from "react";

function subscribe(cb: () => void) {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-intro"] });
  return () => obs.disconnect();
}

/** true quando a abertura não está tocando (para disparar as animações da página). */
export function useIntroDone(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => document.documentElement.dataset.intro !== "play",
    () => true,
  );
}
