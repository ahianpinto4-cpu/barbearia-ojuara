import { bookingConfig } from "@/config/site";
import type { AvailabilityResult } from "./types";

/**
 * Contrato para fontes de disponibilidade.
 *
 * Hoje o site usa `requestOnlyProvider`: nenhum horário é apresentado como
 * "disponível", pois não há controle de agenda. Para integrar uma agenda real
 * (banco de dados, Google Calendar, sistema de gestão), implemente
 * `AvailabilityProvider` — por exemplo, chamando uma Route Handler em
 * `src/app/api/disponibilidade/route.ts` — e troque o `availabilityProvider`
 * exportado no fim deste arquivo.
 */
export interface AvailabilityProvider {
  getAvailability(input: { date: string; serviceId: string; barberId: string | null }): Promise<AvailabilityResult>;
}

export const requestOnlyProvider: AvailabilityProvider = {
  async getAvailability() {
    return { mode: "request" };
  },
};

/*
// Exemplo de integração futura:
export const apiProvider: AvailabilityProvider = {
  async getAvailability({ date, serviceId, barberId }) {
    const params = new URLSearchParams({ date, serviceId, barberId: barberId ?? "" });
    const res = await fetch(`/api/disponibilidade?${params}`);
    if (!res.ok) return { mode: "request" };
    return res.json();
  },
};
*/

export const availabilityProvider: AvailabilityProvider = requestOnlyProvider;

/* ---------------------------- Regras de calendário --------------------------- */

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function startOfToday(): Date {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
}

export function isDateSelectable(d: Date): boolean {
  const today = startOfToday();
  const max = new Date(today);
  max.setDate(max.getDate() + bookingConfig.maxDaysAhead);
  if (d < today || d > max) return false;
  if (bookingConfig.closedWeekdays.includes(d.getDay())) return false;
  if (bookingConfig.closedDates.includes(toISODate(d))) return false;
  return true;
}

export function formatDateLong(iso: string): string {
  const s = fromISODate(iso).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatDateShort(iso: string): string {
  return fromISODate(iso).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });
}
