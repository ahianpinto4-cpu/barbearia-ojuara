"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** Ano atualizado automaticamente no navegador do visitante. */
export function CurrentYear({ fallback }: { fallback: number }) {
  const year = useSyncExternalStore(subscribe, () => new Date().getFullYear(), () => fallback);
  return <span>{year}</span>;
}
