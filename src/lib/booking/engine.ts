/**
 * Motor de disponibilidade (função pura, sem banco de dados).
 * Calcula os horários de início possíveis para um serviço em um dia,
 * considerando funcionamento, jornada do barbeiro (com pausas), bloqueios,
 * agendamentos e atendimentos presenciais já registrados.
 */
export type Interval = { start: number; end: number }; // minutos desde 00:00 (horário local)

export type SlotInput = {
  durationMinutes: number;
  /** Funcionamento da barbearia no dia. null = fechado. */
  businessHours: Interval | null;
  /** Turnos de trabalho do barbeiro no dia (as lacunas entre eles são pausas). */
  workIntervals: Interval[];
  /** Intervalos ocupados (agendamentos ativos, presenciais e bloqueios). */
  busy: Interval[];
  /** Primeiro minuto permitido (ex.: agora + antecedência mínima, se for hoje). */
  earliestStart: number;
  /** Passo entre horários oferecidos, em minutos. */
  step: number;
};

export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

export function computeSlots(input: SlotInput): number[] {
  const { durationMinutes, businessHours, workIntervals, busy, earliestStart, step } = input;
  if (!businessHours || durationMinutes <= 0 || step <= 0) return [];
  const slots: number[] = [];
  for (const shift of workIntervals) {
    // Turno limitado ao funcionamento da barbearia
    const from = Math.max(shift.start, businessHours.start);
    const to = Math.min(shift.end, businessHours.end);
    if (to - from < durationMinutes) continue;
    // Alinha o primeiro horário ao passo (ex.: 09:00, 09:15, 09:30…)
    let start = Math.ceil(Math.max(from, earliestStart) / step) * step;
    if (start < from) start = from;
    for (; start + durationMinutes <= to; start += step) {
      const candidate = { start, end: start + durationMinutes };
      if (!busy.some((b) => overlaps(candidate, b))) slots.push(start);
    }
  }
  return [...new Set(slots)].sort((a, b) => a - b);
}

/** Recorta um intervalo absoluto [startMs, endMs) para minutos do dia local. */
export function clipToDay(
  startLocal: { date: string; minutes: number },
  endLocal: { date: string; minutes: number },
  day: string,
): Interval | null {
  const start = startLocal.date < day ? 0 : startLocal.date > day ? null : startLocal.minutes;
  const end = endLocal.date > day ? 24 * 60 : endLocal.date < day ? null : endLocal.minutes;
  if (start === null || end === null || end <= start) return null;
  return { start, end };
}

export type WorkingHours = Record<string, { start: string; end: string }[]>;
