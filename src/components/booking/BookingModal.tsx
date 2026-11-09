"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Info,
  Loader2,
  Pencil,
  Scissors,
  User,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { barbers, bookingConfig, services, site } from "@/config/site";
import { availabilityProvider, formatDateLong } from "@/lib/booking/availability";
import { buildBookingLink, describeTime, isValidPhone, maskPhone } from "@/lib/booking/message";
import type { AvailabilityResult } from "@/lib/booking/types";
import { formatDuration, formatPrice, whatsappLink } from "@/lib/links";
import { Button, buttonClasses } from "@/components/ui/ButtonLink";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import { Calendar } from "./Calendar";

type StepId = "servico" | "barbeiro" | "data" | "horario" | "dados" | "resumo";

const STEP_META: Record<StepId, { label: string; title: string }> = {
  servico: { label: "Serviço", title: "Qual serviço você deseja?" },
  barbeiro: { label: "Barbeiro", title: "Tem preferência de barbeiro?" },
  data: { label: "Data", title: "Escolha a data desejada" },
  horario: { label: "Horário", title: "Qual horário você prefere?" },
  dados: { label: "Seus dados", title: "Como podemos te chamar?" },
  resumo: { label: "Resumo", title: "Confira sua solicitação" },
};

const STEPS: StepId[] = ["servico", ...(barbers.length > 0 ? (["barbeiro"] as const) : []), "data", "horario", "dados", "resumo"];

type Props = { isOpen: boolean; onClose: () => void; initialServiceId?: string };

export function BookingModal({ isOpen, onClose, initialServiceId }: Props) {
  const reduce = useReducedMotion();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const [stepIndex, setStepIndex] = useState(initialServiceId ? 1 : 0);
  const [direction, setDirection] = useState(1);
  const [serviceId, setServiceId] = useState<string | null>(initialServiceId ?? null);
  const [barberId, setBarberId] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [period, setPeriod] = useState<string | null>(null);
  const [time, setTime] = useState<string>("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [touched, setTouched] = useState({ name: false, phone: false });
  const [availability, setAvailability] = useState<{ key: string; result: AvailabilityResult } | null>(null);
  const [sent, setSent] = useState(false);

  const step = STEPS[stepIndex];
  const service = services.find((s) => s.id === serviceId) ?? null;
  const barber = barbers.find((b) => b.id === barberId) ?? null;

  /* ---- Abertura: trava rolagem, foco, Esc, armadilha de foco ---- */
  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => panelRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus(), 60);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && panelRef.current) {
        const f = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
  }, [isOpen, onClose]);

  /* ---- Consulta de disponibilidade (pronta para integração futura) ---- */
  const availabilityKey = `${date}|${serviceId}|${barberId}`;
  const loadingSlots = step === "horario" && availability?.key !== availabilityKey;
  const slotsResult = availability?.key === availabilityKey ? availability.result : null;

  useEffect(() => {
    if (step !== "horario" || !date || !serviceId) return;
    let active = true;
    const key = `${date}|${serviceId}|${barberId}`;
    const minDelay = new Promise((r) => setTimeout(r, 350));
    Promise.all([availabilityProvider.getAvailability({ date, serviceId, barberId }), minDelay])
      .then(([result]) => active && setAvailability({ key, result }))
      .catch(() => active && setAvailability({ key, result: { mode: "request" } }));
    return () => {
      active = false;
    };
  }, [step, date, serviceId, barberId]);

  const nameValid = name.trim().length >= 2;
  const phoneValid = isValidPhone(phone);

  const canContinue: Record<StepId, boolean> = {
    servico: !!serviceId,
    barbeiro: true,
    data: !!date,
    horario: !loadingSlots && (!!period || /^\d{2}:\d{2}$/.test(time)),
    dados: nameValid && phoneValid,
    resumo: true,
  };

  const goTo = (i: number) => {
    setDirection(i > stepIndex ? 1 : -1);
    setStepIndex(i);
    bodyRef.current?.scrollTo({ top: 0 });
  };
  const next = () => {
    if (step === "dados") setTouched({ name: true, phone: true });
    if (!canContinue[step]) return;
    goTo(Math.min(stepIndex + 1, STEPS.length - 1));
  };
  const back = () => goTo(Math.max(stepIndex - 1, 0));

  const request =
    service && date
      ? {
          serviceId: service.id,
          serviceName: service.name,
          barberId: barber?.id ?? null,
          barberName: barber?.name ?? null,
          date,
          period: bookingConfig.periods.find((p) => p.id === period)?.label ?? null,
          time: time || null,
          customerName: name,
          customerPhone: phone,
        }
      : null;

  const variants = {
    enter: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, x: d * 36 }),
    center: { opacity: 1, x: 0 },
    exit: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, x: d * -36 }),
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <button aria-label="Fechar agendamento" tabIndex={-1} onClick={onClose} className="absolute inset-0 cursor-default bg-black/80 backdrop-blur-sm" />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 40 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="relative flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-line bg-ink-2 shadow-2xl sm:rounded-md"
          >
            {/* Cabeçalho */}
            <div className="border-b border-line px-5 pt-5 pb-4 sm:px-8 sm:pt-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="eyebrow">Agendamento</p>
                  <h2 id={titleId} data-autofocus tabIndex={-1} className="mt-3 font-display text-2xl leading-tight text-ice outline-none sm:text-3xl">
                    {sent ? "Quase lá!" : STEP_META[step].title}
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  aria-label="Fechar"
                  className="grid size-11 shrink-0 place-items-center rounded-full border border-line text-mute transition hover:rotate-90 hover:border-gold hover:text-gold"
                >
                  <X className="size-5" />
                </button>
              </div>

              {!sent && (
                <div className="mt-5">
                  <div className="flex gap-1.5" aria-hidden>
                    {STEPS.map((s, i) => (
                      <span key={s} className="h-[3px] flex-1 overflow-hidden rounded-full bg-line">
                        <motion.span
                          className="block h-full bg-gold"
                          initial={false}
                          animate={{ width: i <= stepIndex ? "100%" : "0%" }}
                          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                        />
                      </span>
                    ))}
                  </div>
                  <p className="mt-2.5 text-xs font-medium tracking-wide text-mute" aria-live="polite">
                    Etapa {stepIndex + 1} de {STEPS.length} · {STEP_META[step].label}
                  </p>
                </div>
              )}
            </div>

            {/* Corpo */}
            <div ref={bodyRef} className="relative flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-5 py-6 sm:px-8">
              {sent && request ? (
                <SentState link={buildBookingLink(request)} onClose={onClose} />
              ) : (
                <AnimatePresence mode="wait" custom={direction} initial={false}>
                  <motion.div
                    key={step}
                    custom={direction}
                    variants={variants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {step === "servico" && (
                      <fieldset>
                        <legend className="sr-only">Serviço</legend>
                        <div className="grid gap-3">
                          {services.map((s) => (
                            <OptionCard
                              key={s.id}
                              selected={serviceId === s.id}
                              onSelect={() => setServiceId(s.id)}
                              icon={<Scissors className="size-5" strokeWidth={1.5} />}
                              title={s.name}
                              meta={[formatPrice(s.price), formatDuration(s.durationMinutes)].filter(Boolean).join(" · ")}
                            />
                          ))}
                        </div>
                      </fieldset>
                    )}

                    {step === "barbeiro" && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <OptionCard
                          selected={barberId === null}
                          onSelect={() => setBarberId(null)}
                          icon={<UserRound className="size-5" strokeWidth={1.5} />}
                          title="Sem preferência"
                          meta="O primeiro profissional disponível"
                        />
                        {barbers.map((b) => (
                          <OptionCard
                            key={b.id}
                            selected={barberId === b.id}
                            onSelect={() => setBarberId(b.id)}
                            icon={<User className="size-5" strokeWidth={1.5} />}
                            title={b.name}
                            meta={b.specialty ?? undefined}
                          />
                        ))}
                      </div>
                    )}

                    {step === "data" && (
                      <div>
                        <Calendar value={date} onChange={setDate} />
                        <p className="mt-4 min-h-6 text-sm text-mute" aria-live="polite">
                          {date ? (
                            <>
                              Data escolhida: <strong className="font-semibold text-gold">{formatDateLong(date)}</strong>
                            </>
                          ) : (
                            "Selecione um dia no calendário."
                          )}
                        </p>
                      </div>
                    )}

                    {step === "horario" && (
                      <div>
                        {loadingSlots || !slotsResult ? (
                          <div className="flex flex-col items-center justify-center gap-3 py-14 text-mute" role="status">
                            <Loader2 className="size-7 animate-spin text-gold" />
                            <span className="text-sm">Verificando opções para {date ? formatDateLong(date) : "a data"}…</span>
                          </div>
                        ) : slotsResult.mode === "slots" ? (
                          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                            {slotsResult.slots.map((s) => (
                              <button
                                key={s.time}
                                type="button"
                                disabled={!s.available}
                                onClick={() => setTime(s.time)}
                                aria-pressed={time === s.time}
                                className={`min-h-12 rounded-sm border text-sm font-semibold tabular-nums transition ${
                                  time === s.time ? "border-gold bg-gold text-ink" : "border-line text-ice hover:border-gold/60 disabled:opacity-30"
                                }`}
                              >
                                {s.time}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div>
                            <p className="mb-3 text-sm font-semibold text-ice">Período de preferência</p>
                            <div className="grid grid-cols-3 gap-2.5">
                              {bookingConfig.periods.map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => setPeriod(period === p.id ? null : p.id)}
                                  aria-pressed={period === p.id}
                                  className={`min-h-14 rounded-sm border text-sm font-semibold transition-all duration-300 ${
                                    period === p.id
                                      ? "border-gold bg-gold text-ink"
                                      : "border-line bg-ink text-ice hover:border-gold/60 hover:text-gold"
                                  }`}
                                >
                                  {p.label}
                                </button>
                              ))}
                            </div>

                            <label htmlFor="booking-time" className="mt-6 mb-2 block text-sm font-semibold text-ice">
                              Horário específico <span className="font-normal text-mute">(opcional)</span>
                            </label>
                            <div className="relative">
                              <Clock aria-hidden className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-gold/70" />
                              <input
                                id="booking-time"
                                type="time"
                                value={time}
                                onChange={(e) => setTime(e.target.value)}
                                className="h-14 w-full rounded-sm border border-line bg-ink pr-4 pl-12 text-base text-ice [color-scheme:dark] transition focus:border-gold focus:outline-none"
                              />
                            </div>

                            <Notice>
                              Sem agenda on-line, este horário é uma <strong className="text-ice">preferência</strong>. A equipe da
                              Ojuara confirma a disponibilidade pelo WhatsApp.
                            </Notice>
                          </div>
                        )}
                      </div>
                    )}

                    {step === "dados" && (
                      <form
                        className="grid gap-5"
                        noValidate
                        onSubmit={(e) => {
                          e.preventDefault();
                          next();
                        }}
                      >
                        <Field
                          id="booking-name"
                          label="Nome"
                          value={name}
                          onChange={setName}
                          onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                          error={touched.name && !nameValid ? "Informe seu nome (mínimo de 2 letras)." : null}
                          autoComplete="name"
                          placeholder="Seu nome"
                        />
                        <Field
                          id="booking-phone"
                          label="Telefone / WhatsApp"
                          value={phone}
                          onChange={(v) => setPhone(maskPhone(v))}
                          onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
                          error={touched.phone && !phoneValid ? "Informe um telefone válido com DDD." : null}
                          autoComplete="tel-national"
                          inputMode="tel"
                          placeholder="(79) 99999-9999"
                        />
                        <button type="submit" hidden aria-hidden tabIndex={-1} />
                        <p className="text-xs leading-relaxed text-mute-2">
                          Seus dados são usados apenas para montar a mensagem de agendamento. Nada é armazenado neste site.
                        </p>
                      </form>
                    )}

                    {step === "resumo" && request && (
                      <div>
                        <dl className="divide-y divide-line rounded-sm border border-line bg-ink">
                          <SummaryRow icon={<Scissors />} label="Serviço" value={request.serviceName} onEdit={() => goTo(STEPS.indexOf("servico"))} />
                          {barbers.length > 0 && (
                            <SummaryRow icon={<UserRound />} label="Barbeiro" value={request.barberName ?? "Sem preferência"} onEdit={() => goTo(STEPS.indexOf("barbeiro"))} />
                          )}
                          <SummaryRow icon={<CalendarDays />} label="Data" value={formatDateLong(request.date)} onEdit={() => goTo(STEPS.indexOf("data"))} />
                          <SummaryRow icon={<Clock />} label="Horário" value={describeTime(request)} onEdit={() => goTo(STEPS.indexOf("horario"))} />
                          <SummaryRow icon={<User />} label="Cliente" value={`${request.customerName.trim()} · ${request.customerPhone}`} onEdit={() => goTo(STEPS.indexOf("dados"))} />
                        </dl>
                        <Notice>
                          Esta é uma <strong className="text-ice">solicitação de agendamento</strong>. O horário só fica reservado após a
                          confirmação da barbearia pelo WhatsApp.
                        </Notice>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              )}
            </div>

            {/* Rodapé de ações */}
            {!sent && (
              <div className="flex items-center gap-3 border-t border-line bg-ink-2 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-8">
                {stepIndex > 0 ? (
                  <Button variant="outline" size="md" onClick={back} className="px-4">
                    <ArrowLeft className="size-4" />
                    <span className="hidden sm:inline">Voltar</span>
                  </Button>
                ) : (
                  <a
                    href={whatsappLink()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs leading-snug text-mute underline-offset-4 hover:text-gold hover:underline"
                  >
                    Prefere conversar direto?
                    <br className="sm:hidden" /> Fale no WhatsApp
                  </a>
                )}
                <div className="ml-auto">
                  {step === "resumo" && request ? (
                    <a
                      href={buildBookingLink(request)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setSent(true)}
                      className={buttonClasses("gold", "lg", "px-4 tracking-[0.1em] sm:px-8 sm:tracking-[0.18em]")}
                    >
                      <WhatsAppIcon className="size-5" />
                      Confirmar pelo WhatsApp
                    </a>
                  ) : (
                    <Button onClick={next} disabled={step !== "dados" && !canContinue[step]} size="lg">
                      Continuar
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                    </Button>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------ Subcomponentes ------------------------------ */

function OptionCard({
  selected,
  onSelect,
  icon,
  title,
  meta,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  meta?: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`group flex min-h-18 w-full items-center gap-4 rounded-sm border p-4 text-left transition-all duration-300 ${
        selected ? "border-gold bg-gold/[0.07]" : "border-line bg-ink hover:border-gold/50"
      }`}
    >
      <span
        className={`grid size-11 shrink-0 place-items-center rounded-full border transition ${
          selected ? "border-gold bg-gold text-ink" : "border-line text-gold group-hover:border-gold/60"
        }`}
      >
        {selected ? <Check className="size-5" /> : icon}
      </span>
      <span className="flex-1">
        <span className="block font-semibold text-ice">{title}</span>
        {meta && <span className="mt-0.5 block text-sm text-mute">{meta}</span>}
      </span>
    </button>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  ...input
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  error: string | null;
  autoComplete?: string;
  inputMode?: "tel" | "text";
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-ice">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-err` : undefined}
        className={`h-14 w-full rounded-sm border bg-ink px-4 text-base text-ice placeholder:text-mute-2 transition focus:outline-none ${
          error ? "border-red-400/70" : "border-line focus:border-gold"
        }`}
        {...input}
      />
      {error && (
        <p id={`${id}-err`} className="mt-2 text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}

function SummaryRow({ icon, label, value, onEdit }: { icon: React.ReactElement; label: string; value: string; onEdit: () => void }) {
  return (
    <div className="flex items-center gap-4 px-4 py-4">
      <span className="text-gold [&>svg]:size-5 [&>svg]:stroke-[1.5]" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <dt className="text-[0.65rem] font-semibold tracking-[0.2em] text-mute-2 uppercase">{label}</dt>
        <dd className="mt-0.5 font-medium break-words text-ice">{value}</dd>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="grid size-10 shrink-0 place-items-center rounded-full text-mute transition hover:bg-ink-3 hover:text-gold"
        aria-label={`Alterar ${label.toLowerCase()}`}
      >
        <Pencil className="size-4" />
      </button>
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-5 flex gap-3 rounded-sm border border-gold/20 bg-gold/[0.05] p-4 text-sm leading-relaxed text-mute">
      <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-gold" />
      <span>{children}</span>
    </p>
  );
}

function SentState({ link, onClose }: { link: string; onClose: () => void }) {
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <motion.span
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 18 }}
        className="grid size-16 place-items-center rounded-full border border-gold/40 bg-gold/10 text-gold"
      >
        <CheckCircle2 className="size-8" strokeWidth={1.5} />
      </motion.span>
      <p className="mt-6 max-w-md text-base leading-relaxed text-mute">
        Sua mensagem foi preparada no WhatsApp. <strong className="text-ice">Basta enviá-la</strong> para que a equipe da{" "}
        {site.name} confirme seu horário.
      </p>
      <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
        <a href={link} target="_blank" rel="noopener noreferrer" className={buttonClasses("outline", "md")}>
          <WhatsAppIcon className="size-4" />
          Abrir o WhatsApp novamente
        </a>
        <Button size="md" onClick={onClose}>
          Concluir
        </Button>
      </div>
    </div>
  );
}
