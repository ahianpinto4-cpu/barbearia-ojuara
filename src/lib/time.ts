/**
 * Datas e horários no fuso de São Cristóvão - SE (America/Maceio, UTC-3, sem
 * horário de verão). Todo o sistema de agenda usa estas funções.
 */
export const TIMEZONE = "America/Maceio";
const OFFSET = "-03:00";

const WEEKDAYS_PT = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

export function isISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function isHHMM(s: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

export function timeToMinutes(t: string): number {
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Converte data + hora locais em um instante absoluto. */
export function localToInstant(date: string, time: string): Date {
  return new Date(`${date}T${time.slice(0, 5)}:00${OFFSET}`);
}

const partsFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Converte um instante para data/hora locais. */
export function instantToLocal(d: Date): { date: string; time: string; minutes: number } {
  const p = Object.fromEntries(partsFmt.formatToParts(d).map((x) => [x.type, x.value]));
  const time = `${p.hour}:${p.minute}`;
  return { date: `${p.year}-${p.month}-${p.day}`, time, minutes: timeToMinutes(time) };
}

export function todayLocal(now: Date = new Date()): string {
  return instantToLocal(now).date;
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function weekdayOf(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

export function weekdayName(date: string): string {
  return WEEKDAYS_PT[weekdayOf(date)];
}

/** "terça-feira, 10/11/2026" */
export function formatDatePt(date: string): string {
  const [y, m, d] = date.split("-");
  return `${weekdayName(date)}, ${d}/${m}/${y}`;
}

export function formatDateShortPt(date: string): string {
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

export function formatPriceBRL(price: number | null): string {
  if (price === null || price === undefined) return "valor sob consulta";
  return Number(price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export { WEEKDAYS_PT };
