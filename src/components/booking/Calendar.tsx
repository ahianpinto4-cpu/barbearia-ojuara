"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { bookingConfig } from "@/config/site";
import { fromISODate, isDateSelectable, startOfToday, toISODate } from "@/lib/booking/availability";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

type Props = { value: string | null; onChange: (iso: string) => void };

export function Calendar({ value, onChange }: Props) {
  const today = startOfToday();
  const initial = value ? fromISODate(value) : today;
  const [cursor, setCursor] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));

  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + bookingConfig.maxDaysAhead);

  const canPrev = cursor > new Date(today.getFullYear(), today.getMonth(), 1);
  const canNext = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1) <= maxDate;

  const days = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const total = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const cells: (Date | null)[] = Array.from({ length: first.getDay() }, () => null);
    for (let d = 1; d <= total; d++) cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    return cells;
  }, [cursor]);

  const rawLabel = cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const monthLabel = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1);
  const todayISO = toISODate(today);

  return (
    <div className="rounded-sm border border-line bg-ink p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          disabled={!canPrev}
          aria-label="Mês anterior"
          className="grid size-11 place-items-center rounded-full border border-line text-ice transition hover:border-gold hover:text-gold disabled:pointer-events-none disabled:opacity-25"
        >
          <ChevronLeft className="size-5" />
        </button>
        <p className="font-display text-xl text-ice" aria-live="polite">
          {monthLabel}
        </p>
        <button
          type="button"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          disabled={!canNext}
          aria-label="Próximo mês"
          className="grid size-11 place-items-center rounded-full border border-line text-ice transition hover:border-gold hover:text-gold disabled:pointer-events-none disabled:opacity-25"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center" role="grid" aria-label={`Calendário de ${monthLabel}`}>
        {WEEKDAYS.map((w) => (
          <div key={w} role="columnheader" className="pb-2 text-[0.65rem] font-semibold tracking-[0.15em] text-mute-2 uppercase">
            {w}
          </div>
        ))}
        {days.map((d, i) => {
          if (!d) return <div key={`e${i}`} aria-hidden />;
          const iso = toISODate(d);
          const selectable = isDateSelectable(d);
          const selected = value === iso;
          const isToday = iso === todayISO;
          return (
            <button
              key={iso}
              type="button"
              role="gridcell"
              disabled={!selectable}
              aria-selected={selected}
              aria-label={d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }) + (isToday ? " (hoje)" : "")}
              onClick={() => onChange(iso)}
              className={[
                "relative mx-auto grid aspect-square w-full max-w-12 place-items-center rounded-full text-sm font-semibold tabular-nums transition-all duration-300",
                selected
                  ? "bg-gold text-ink shadow-[0_8px_24px_-10px_rgba(201,164,76,.8)]"
                  : selectable
                    ? "text-ice hover:bg-ink-3 hover:text-gold"
                    : "cursor-not-allowed text-mute-2/40 line-through decoration-mute-2/30",
              ].join(" ")}
            >
              {d.getDate()}
              {isToday && !selected && <span aria-hidden className="absolute bottom-1.5 size-1 rounded-full bg-gold" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
