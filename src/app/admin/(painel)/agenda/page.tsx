import Link from "next/link";
import { ChevronLeft, ChevronRight, Lock, Trash2 } from "lucide-react";
import { listAppointmentsBetween, listBarbers, listBlocksBetween, listServices, type AppointmentView } from "@/lib/server/booking";
import { addDays, formatDatePt, instantToLocal, isISODate, timeToMinutes, todayLocal, weekdayOf } from "@/lib/time";
import { AutoRefresh, SubmitButton } from "@/components/admin/client";
import { Badge, btn, Card, EmptyState, Field, Flash, inputCls, PageHeader, SourceBadge, StatusBadge } from "@/components/admin/ui";
import {
  appointmentStatusAction,
  blockAction,
  createAdminAppointmentAction,
  deleteBlockAction,
  rescheduleAction,
  walkInAction,
} from "../../actions";

type SP = Promise<{ data?: string; visao?: string; barbeiro?: string; ok?: string; erro?: string }>;

const START_HOUR = 7;
const END_HOUR = 21;
const PX_PER_MIN = 1.1;

export default async function AgendaPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const today = todayLocal();
  const date = sp.data && isISODate(sp.data) ? sp.data : today;
  const view = sp.visao === "semana" ? "semana" : "dia";
  const barberFilter = sp.barbeiro || "";
  const weekStart = addDays(date, -weekdayOf(date)); // domingo
  const from = view === "dia" ? date : weekStart;
  const to = view === "dia" ? date : addDays(weekStart, 6);

  const [appointments, barbers, services, blocks] = await Promise.all([
    listAppointmentsBetween(from, to, { barberId: barberFilter || null, includeCancelled: true }),
    listBarbers(),
    listServices(),
    listBlocksBetween(from, to),
  ]);
  const shownBarbers = barbers.filter((b) => !barberFilter || b.id === barberFilter);
  const qs = (o: Record<string, string>) => {
    const p = new URLSearchParams({ data: date, visao: view, ...(barberFilter ? { barbeiro: barberFilter } : {}), ...o });
    return `/admin/agenda?${p}`;
  };
  const returnTo = qs({});
  const step = view === "dia" ? 1 : 7;

  return (
    <>
      <AutoRefresh seconds={30} />
      <PageHeader
        title="Agenda"
        subtitle={view === "dia" ? formatDatePt(date) : `Semana de ${from.split("-").reverse().join("/")} a ${to.split("-").reverse().join("/")}`}
        actions={
          <>
            <Link className={btn.outline} href={qs({ data: addDays(date, -step) })} aria-label="Anterior">
              <ChevronLeft className="size-4" />
            </Link>
            <Link className={btn.outline} href={qs({ data: today })}>
              Hoje
            </Link>
            <Link className={btn.outline} href={qs({ data: addDays(date, step) })} aria-label="Próximo">
              <ChevronRight className="size-4" />
            </Link>
            <Link className={view === "dia" ? btn.gold : btn.outline} href={qs({ visao: "dia" })}>
              Dia
            </Link>
            <Link className={view === "semana" ? btn.gold : btn.outline} href={qs({ visao: "semana" })}>
              Semana
            </Link>
          </>
        }
      />
      <Flash ok={sp.ok} erro={sp.erro} />

      <form className="mb-6 flex flex-wrap items-end gap-3" action="/admin/agenda">
        <input type="hidden" name="visao" value={view} />
        <Field label="Data">
          <input type="date" name="data" defaultValue={date} className={inputCls} />
        </Field>
        <Field label="Barbeiro">
          <select name="barbeiro" defaultValue={barberFilter} className={inputCls}>
            <option value="">Todos</option>
            {barbers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>
        <button className={btn.outline}>Filtrar</button>
      </form>

      {barbers.length === 0 && (
        <div className="mb-6">
          <EmptyState>
            Nenhum barbeiro cadastrado. <Link href="/admin/barbeiros" className="text-gold underline">Cadastre os profissionais</Link> e{" "}
            <Link href="/admin/configuracoes" className="text-gold underline">o horário de funcionamento</Link> para liberar a agenda.
          </EmptyState>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="min-w-0">
          {view === "dia" ? (
            <DayView date={date} barbers={shownBarbers} appointments={appointments} blocks={blocks} returnTo={returnTo} />
          ) : (
            <WeekView from={from} appointments={appointments} blocks={blocks} returnTo={returnTo} dayLink={(d) => qs({ data: d, visao: "dia" })} />
          )}
        </div>

        <div className="space-y-4">
          <Card title="Novo agendamento">
            <form action={createAdminAppointmentAction} className="grid gap-3">
              <input type="hidden" name="returnTo" value={returnTo} />
              <Field label="Cliente">
                <input name="name" required placeholder="Nome" className={inputCls} />
              </Field>
              <Field label="WhatsApp (opcional)" hint="Com DDD. Usado para lembretes.">
                <input name="phone" inputMode="tel" placeholder="79 9xxxx-xxxx" className={inputCls} />
              </Field>
              <ServiceBarberFields services={services} barbers={barbers} anyBarber />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Data">
                  <input type="date" name="date" required defaultValue={date} className={inputCls} />
                </Field>
                <Field label="Horário">
                  <input type="time" name="time" required step={300} className={inputCls} />
                </Field>
              </div>
              <SubmitButton className={btn.gold}>Agendar</SubmitButton>
              <p className="text-xs text-mute-2">A disponibilidade é verificada de novo ao salvar.</p>
            </form>
          </Card>

          <Card title="Registrar atendimento presencial">
            <form action={walkInAction} className="grid gap-3">
              <input type="hidden" name="returnTo" value={returnTo} />
              <ServiceBarberFields services={services} barbers={barbers} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Início">
                  <input type="time" name="time" required defaultValue={instantToLocal(new Date()).time} className={inputCls} />
                </Field>
                <Field label="Duração (min)">
                  <input type="number" name="duration" required min={5} max={480} defaultValue={30} className={inputCls} />
                </Field>
              </div>
              <input type="hidden" name="date" value={date} />
              <Field label="Cliente (opcional)">
                <input name="name" placeholder="Nome" className={inputCls} />
              </Field>
              <SubmitButton className={btn.gold}>Registrar e bloquear intervalo</SubmitButton>
              <p className="text-xs text-mute-2">Data: {formatDatePt(date)}. A IA não oferecerá esse intervalo.</p>
            </form>
          </Card>

          <Card title="Bloquear horário">
            <form action={blockAction} className="grid gap-3">
              <input type="hidden" name="returnTo" value={returnTo} />
              <Field label="Profissional">
                <select name="barberId" className={inputCls}>
                  <option value="">Todos (barbearia inteira)</option>
                  {barbers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Data">
                <input type="date" name="date" required defaultValue={date} className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="De">
                  <input type="time" name="start" required className={inputCls} />
                </Field>
                <Field label="Até">
                  <input type="time" name="end" required className={inputCls} />
                </Field>
              </div>
              <Field label="Motivo (opcional)">
                <input name="reason" placeholder="Ex.: almoço, compromisso" className={inputCls} />
              </Field>
              <SubmitButton className={btn.outline}>
                <Lock className="size-3.5" /> Bloquear
              </SubmitButton>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}

function ServiceBarberFields({
  services,
  barbers,
  anyBarber,
}: {
  services: Awaited<ReturnType<typeof listServices>>;
  barbers: Awaited<ReturnType<typeof listBarbers>>;
  anyBarber?: boolean;
}) {
  return (
    <>
      <Field label="Serviço">
        <select name="serviceId" required className={inputCls} defaultValue="">
          <option value="" disabled>
            Selecione
          </option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.duration_minutes ? ` (${s.duration_minutes} min)` : " (sem duração)"}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Profissional">
        <select name="barberId" required={!anyBarber} className={inputCls} defaultValue="">
          <option value="" disabled={!anyBarber}>
            {anyBarber ? "Qualquer disponível" : "Selecione"}
          </option>
          {barbers.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </Field>
    </>
  );
}

type Block = Awaited<ReturnType<typeof listBlocksBetween>>[number];

function DayView({
  date,
  barbers,
  appointments,
  blocks,
  returnTo,
}: {
  date: string;
  barbers: Awaited<ReturnType<typeof listBarbers>>;
  appointments: AppointmentView[];
  blocks: Block[];
  returnTo: string;
}) {
  const height = (END_HOUR - START_HOUR) * 60 * PX_PER_MIN;
  const top = (min: number) => Math.max(0, (min - START_HOUR * 60) * PX_PER_MIN);
  const cancelled = appointments.filter((a) => a.status === "cancelled");

  if (barbers.length === 0) return <EmptyState>Sem profissionais para exibir.</EmptyState>;

  return (
    <>
      <div className="overflow-x-auto rounded-md border border-line bg-ink-2">
        <div className="grid min-w-[36rem]" style={{ gridTemplateColumns: `3.5rem repeat(${barbers.length}, minmax(12rem, 1fr))` }}>
          <div className="border-b border-line" />
          {barbers.map((b) => (
            <div key={b.id} className="border-b border-l border-line px-3 py-3 text-sm font-semibold text-ice">
              {b.name}
            </div>
          ))}
          <div className="relative" style={{ height }}>
            {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
              <span key={i} className="absolute right-2 text-[0.65rem] text-mute-2 tabular-nums" style={{ top: i * 60 * PX_PER_MIN - 6 }}>
                {String(START_HOUR + i).padStart(2, "0")}:00
              </span>
            ))}
          </div>
          {barbers.map((b) => {
            const shifts = b.working_hours?.[String(weekdayOf(date))] ?? [];
            const appts = appointments.filter((a) => a.barber_id === b.id && a.status !== "cancelled");
            const bl = blocks.filter((x) => !x.barber_id || x.barber_id === b.id);
            return (
              <div key={b.id} className="relative border-l border-line" style={{ height }}>
                {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
                  <div key={i} className="absolute inset-x-0 border-t border-line/50" style={{ top: i * 60 * PX_PER_MIN }} />
                ))}
                {shifts.map((s, i) => (
                  <div
                    key={i}
                    className="absolute inset-x-0 bg-gold/[0.04]"
                    style={{ top: top(timeToMinutes(s.start)), height: (timeToMinutes(s.end) - timeToMinutes(s.start)) * PX_PER_MIN }}
                  />
                ))}
                {bl.map((x) => {
                  const s = instantToLocal(new Date(x.start_at));
                  const e = instantToLocal(new Date(x.end_at));
                  const sm = s.date < date ? 0 : s.minutes;
                  const em = e.date > date ? 24 * 60 : e.minutes;
                  return (
                    <div
                      key={x.id}
                      className="absolute inset-x-1 overflow-hidden rounded-sm border border-dashed border-mute-2/50 bg-[repeating-linear-gradient(135deg,rgba(255,255,255,.04)_0_6px,transparent_6px_12px)] px-2 py-1 text-[0.7rem] text-mute"
                      style={{ top: top(sm), height: Math.max(18, (em - sm) * PX_PER_MIN) }}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="truncate">
                          <Lock className="mr-1 inline size-3" />
                          {x.reason ?? "Bloqueado"}
                        </span>
                        <form action={deleteBlockAction}>
                          <input type="hidden" name="id" value={x.id} />
                          <input type="hidden" name="returnTo" value={returnTo} />
                          <button aria-label="Remover bloqueio" className="text-mute hover:text-[#ff8a66]">
                            <Trash2 className="size-3" />
                          </button>
                        </form>
                      </div>
                    </div>
                  );
                })}
                {appts.map((a) => {
                  const sm = timeToMinutes(a.start_time);
                  const em = timeToMinutes(a.end_time);
                  return (
                    <details
                      key={a.id}
                      className={`group absolute inset-x-1 rounded-sm border px-2 py-1 text-[0.72rem] open:z-20 open:h-auto ${
                        a.source === "walk_in" ? "border-sky-500/50 bg-sky-500/15" : "border-gold/50 bg-gold/15"
                      }`}
                      style={{ top: top(sm), minHeight: Math.max(22, (em - sm) * PX_PER_MIN) }}
                    >
                      <summary className="cursor-pointer list-none">
                        <span className="font-semibold text-ice tabular-nums">
                          {a.start_time}–{a.end_time}
                        </span>{" "}
                        <span className="text-ice/90">{a.customer_name ?? "Cliente"}</span>
                        <span className="block truncate text-mute">{a.service_name}</span>
                      </summary>
                      <div className="mt-2 rounded-sm border border-line bg-ink p-2 shadow-xl">
                        <AppointmentActions a={a} returnTo={returnTo} />
                      </div>
                    </details>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      {cancelled.length > 0 && (
        <p className="mt-3 text-xs text-mute-2">
          {cancelled.length} cancelado(s) neste dia: {cancelled.map((a) => `${a.start_time} ${a.customer_name ?? ""}`).join(", ")}
        </p>
      )}
    </>
  );
}

function WeekView({
  from,
  appointments,
  blocks,
  returnTo,
  dayLink,
}: {
  from: string;
  appointments: AppointmentView[];
  blocks: Block[];
  returnTo: string;
  dayLink: (d: string) => string;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  const today = todayLocal();
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
      {days.map((d) => {
        const list = appointments.filter((a) => a.appointment_date === d && a.status !== "cancelled");
        const bl = blocks.filter((b) => instantToLocal(new Date(b.start_at)).date <= d && instantToLocal(new Date(b.end_at)).date >= d);
        return (
          <div key={d} className={`rounded-md border bg-ink-2 ${d === today ? "border-gold/60" : "border-line"}`}>
            <Link href={dayLink(d)} className="block border-b border-line px-3 py-2 text-sm font-semibold text-ice hover:text-gold">
              {formatDatePt(d).split(",")[0]} <span className="text-mute">{d.slice(8, 10)}/{d.slice(5, 7)}</span>
            </Link>
            <ul className="space-y-2 p-2">
              {list.length === 0 && bl.length === 0 && <li className="px-1 py-3 text-xs text-mute-2">Livre</li>}
              {bl.map((b) => (
                <li key={b.id} className="rounded-sm border border-dashed border-line px-2 py-1.5 text-[0.7rem] text-mute">
                  <Lock className="mr-1 inline size-3" />
                  {instantToLocal(new Date(b.start_at)).time}–{instantToLocal(new Date(b.end_at)).time} {b.barber_name ?? "Todos"}
                </li>
              ))}
              {list.map((a) => (
                <li key={a.id}>
                  <details className="rounded-sm border border-line bg-ink px-2 py-1.5 text-xs">
                    <summary className="cursor-pointer list-none">
                      <span className="font-semibold text-gold tabular-nums">{a.start_time}</span> {a.customer_name ?? "Cliente"}
                      <span className="block truncate text-mute">
                        {a.service_name} · {a.barber_name}
                      </span>
                    </summary>
                    <div className="mt-2">
                      <AppointmentActions a={a} returnTo={returnTo} />
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function AppointmentActions({ a, returnTo }: { a: AppointmentView; returnTo: string }) {
  const statusForm = (status: string, label: string, cls = btn.small, confirm?: string) => (
    <form action={appointmentStatusAction}>
      <input type="hidden" name="id" value={a.id} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <SubmitButton className={cls} confirm={confirm}>
        {label}
      </SubmitButton>
    </form>
  );
  return (
    <div className="space-y-2 text-xs">
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge status={a.status} />
        <SourceBadge source={a.source} />
        {a.is_test && <Badge tone="gold">teste</Badge>}
      </div>
      <p className="text-mute">
        {a.service_name} · {a.barber_name}
        {a.customer_phone && <span className="block">+{a.customer_phone}</span>}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {a.status === "pending" && statusForm("confirmed", "Confirmar")}
        {["confirmed", "pending"].includes(a.status) && statusForm("in_progress", "Iniciar")}
        {["confirmed", "in_progress"].includes(a.status) && statusForm("completed", "Concluir")}
        {["confirmed", "pending"].includes(a.status) && statusForm("no_show", "Faltou")}
        {["confirmed", "pending", "in_progress"].includes(a.status) &&
          statusForm("cancelled", "Cancelar", `${btn.small} border-ember/50 text-[#ff8a66]`, "Cancelar este agendamento?")}
      </div>
      {["confirmed", "pending"].includes(a.status) && (
        <form action={rescheduleAction} className="flex flex-wrap items-end gap-1.5 border-t border-line pt-2">
          <input type="hidden" name="id" value={a.id} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <input type="date" name="date" defaultValue={a.appointment_date} required className={`${inputCls} h-8 w-auto text-xs`} />
          <input type="time" name="time" defaultValue={a.start_time} required className={`${inputCls} h-8 w-auto text-xs`} />
          <SubmitButton className={btn.small}>Reagendar</SubmitButton>
        </form>
      )}
    </div>
  );
}
