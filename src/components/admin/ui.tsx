import type { ReactNode } from "react";

/** Componentes visuais do painel (identidade Ojuara: preto, dourado e vermelho da marca). */

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-3xl text-ice sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-mute">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, children, className = "", actions }: { title?: string; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={`rounded-md border border-line bg-ink-2 ${className}`}>
      {title && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="text-sm font-semibold tracking-wide text-ice">{title}</h2>
          {actions}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint, tone = "default" }: { label: string; value: ReactNode; hint?: string; tone?: "default" | "gold" | "ember" }) {
  const color = tone === "gold" ? "text-gold" : tone === "ember" ? "text-ember" : "text-ice";
  return (
    <div className="rounded-md border border-line bg-ink-2 p-5">
      <p className="text-[0.68rem] font-semibold tracking-[0.2em] text-mute uppercase">{label}</p>
      <p className={`mt-3 font-display text-4xl ${color}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-mute-2">{hint}</p>}
    </div>
  );
}

const badgeTones = {
  gold: "border-gold/40 bg-gold/10 text-gold",
  ember: "border-ember/50 bg-ember/10 text-[#ff7a52]",
  green: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  gray: "border-line bg-ink-3 text-mute",
  blue: "border-sky-500/40 bg-sky-500/10 text-sky-300",
} as const;

export function Badge({ children, tone = "gray" }: { children: ReactNode; tone?: keyof typeof badgeTones }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[0.68rem] font-semibold tracking-wide whitespace-nowrap ${badgeTones[tone]}`}>
      {children}
    </span>
  );
}

export const inputCls =
  "h-11 w-full rounded-sm border border-line bg-ink px-3 text-sm text-ice placeholder:text-mute-2 focus:border-gold focus:outline-none [color-scheme:dark]";

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold tracking-wide text-mute">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-mute-2">{hint}</span>}
    </label>
  );
}

export function Flash({ ok, erro }: { ok?: string; erro?: string }) {
  if (!ok && !erro) return null;
  return (
    <div
      role="status"
      className={`mb-6 rounded-sm border px-4 py-3 text-sm ${erro ? "border-ember/50 bg-ember/10 text-[#ffb59e]" : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"}`}
    >
      {erro ?? ok}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-sm border border-dashed border-line px-4 py-8 text-center text-sm text-mute">{children}</p>;
}

export const btn = {
  gold: "inline-flex min-h-10 items-center justify-center gap-2 rounded-sm bg-gold px-4 text-xs font-bold tracking-[0.12em] text-ink uppercase transition hover:bg-gold-soft disabled:opacity-50",
  outline:
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-sm border border-line px-4 text-xs font-bold tracking-[0.12em] text-ice uppercase transition hover:border-gold hover:text-gold disabled:opacity-50",
  danger:
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-sm border border-ember/50 px-4 text-xs font-bold tracking-[0.12em] text-[#ff8a66] uppercase transition hover:bg-ember/15 disabled:opacity-50",
  small:
    "inline-flex min-h-8 items-center justify-center gap-1.5 rounded-sm border border-line px-2.5 text-[0.7rem] font-semibold text-ice transition hover:border-gold hover:text-gold",
};

const statusLabels: Record<string, [string, keyof typeof badgeTones]> = {
  pending: ["Pendente", "gold"],
  confirmed: ["Confirmado", "green"],
  in_progress: ["Em atendimento", "blue"],
  completed: ["Concluído", "gray"],
  cancelled: ["Cancelado", "ember"],
  no_show: ["Não compareceu", "ember"],
  AI_ACTIVE: ["IA ativa", "green"],
  AI_RESUMED: ["IA reativada", "green"],
  HUMAN_REQUESTED: ["Pediu humano", "ember"],
  HUMAN_ACTIVE: ["Atendimento humano", "gold"],
  AI_PAUSED: ["IA pausada", "gray"],
};

export function StatusBadge({ status }: { status: string }) {
  const [label, tone] = statusLabels[status] ?? [status, "gray"];
  return <Badge tone={tone}>{label}</Badge>;
}

const sourceLabels: Record<string, string> = { whatsapp: "WhatsApp", site: "Site", admin: "Painel", walk_in: "Presencial" };
export function SourceBadge({ source }: { source: string }) {
  return <Badge tone={source === "walk_in" ? "blue" : "gray"}>{sourceLabels[source] ?? source}</Badge>;
}
