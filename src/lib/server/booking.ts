import type { PoolClient } from "pg";
import { clipToDay, computeSlots, type Interval, type WorkingHours } from "@/lib/booking/engine";
import {
  addDays,
  instantToLocal,
  isHHMM,
  isISODate,
  localToInstant,
  minutesToTime,
  timeToMinutes,
  todayLocal,
  weekdayOf,
} from "@/lib/time";
import { db, pgErrorCode, PG_EXCLUSION_VIOLATION, withTransaction, type Queryable } from "./db";
import { logEvent } from "./log";
import { getSettings, type Settings } from "./settings";

/* ================================== Tipos ================================== */

export type ServiceRow = {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  duration_minutes: number | null;
  active: boolean;
  sort_order: number;
};

export type BarberRow = {
  id: string;
  name: string;
  active: boolean;
  working_hours: WorkingHours;
  sort_order: number;
};

export type AppointmentStatus = "pending" | "confirmed" | "in_progress" | "completed" | "cancelled" | "no_show";
export type AppointmentSource = "whatsapp" | "site" | "admin" | "walk_in";

export type AppointmentView = {
  id: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  barber_id: string;
  barber_name: string;
  service_id: string;
  service_name: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  start_at: Date;
  end_at: Date;
  status: AppointmentStatus;
  source: AppointmentSource;
  price: number | null;
  notes: string | null;
  is_test: boolean;
};

export class BookingError extends Error {
  constructor(
    public code:
      | "INVALID_INPUT"
      | "SERVICE_NOT_FOUND"
      | "SERVICE_NOT_BOOKABLE"
      | "BARBER_NOT_FOUND"
      | "DATE_OUT_OF_RANGE"
      | "CLOSED"
      | "SLOT_UNAVAILABLE"
      | "APPOINTMENT_NOT_FOUND"
      | "NOT_ALLOWED"
      | "CONFLICT",
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

const ACTIVE_STATUSES: AppointmentStatus[] = ["pending", "confirmed", "in_progress"];

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

function mapService(r: Record<string, unknown>): ServiceRow {
  return {
    id: String(r.id),
    name: String(r.name),
    description: (r.description as string) ?? null,
    price: num(r.price),
    duration_minutes: num(r.duration_minutes),
    active: Boolean(r.active),
    sort_order: Number(r.sort_order ?? 0),
  };
}

/* ============================ Catálogo (leitura) ============================ */

export async function listServices(opts: { includeInactive?: boolean } = {}, q: Queryable = db): Promise<ServiceRow[]> {
  const { rows } = await q.query(
    `select * from services where deleted_at is null ${opts.includeInactive ? "" : "and active"} order by sort_order, name`,
  );
  return rows.map(mapService);
}

export async function getService(id: string, q: Queryable = db): Promise<ServiceRow | null> {
  if (!isUuid(id)) return null;
  const { rows } = await q.query(`select * from services where id = $1 and deleted_at is null`, [id]);
  return rows[0] ? mapService(rows[0]) : null;
}

export async function listBarbers(opts: { includeInactive?: boolean } = {}, q: Queryable = db): Promise<BarberRow[]> {
  const { rows } = await q.query<BarberRow>(
    `select id, name, active, working_hours, sort_order from barbers
     where deleted_at is null ${opts.includeInactive ? "" : "and active"} order by sort_order, name`,
  );
  return rows;
}

export async function getBusinessHours(q: Queryable = db) {
  const { rows } = await q.query<{ day_of_week: number; opening_time: string; closing_time: string; active: boolean }>(
    `select day_of_week, to_char(opening_time, 'HH24:MI') as opening_time, to_char(closing_time, 'HH24:MI') as closing_time, active
     from business_hours order by day_of_week`,
  );
  return rows;
}

export function isUuid(s: unknown): s is string {
  return typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

/* =========================== Disponibilidade =========================== */

export type BarberAvailability = { barber_id: string; barber_name: string; slots: string[] };

export type AvailabilityResult =
  | { ok: true; date: string; service: ServiceRow; barbers: BarberAvailability[] }
  | { ok: false; code: BookingError["code"]; message: string };

type DayContext = {
  businessHours: Interval | null;
  barbers: BarberRow[];
  busyByBarber: Map<string, Interval[]>;
};

async function loadDayContext(
  q: Queryable,
  date: string,
  barberIds: string[] | null,
  excludeAppointmentId?: string,
): Promise<DayContext> {
  const dow = weekdayOf(date);
  const bh = await q.query<{ opening_time: string; closing_time: string }>(
    `select to_char(opening_time, 'HH24:MI') as opening_time, to_char(closing_time, 'HH24:MI') as closing_time
     from business_hours where day_of_week = $1 and active`,
    [dow],
  );
  const businessHours = bh.rows[0]
    ? { start: timeToMinutes(bh.rows[0].opening_time), end: timeToMinutes(bh.rows[0].closing_time) }
    : null;

  const barbers = (await listBarbers({}, q)).filter((b) => !barberIds || barberIds.includes(b.id));
  const dayStart = localToInstant(date, "00:00");
  const dayEnd = localToInstant(addDays(date, 1), "00:00");
  const ids = barbers.map((b) => b.id);
  const busyByBarber = new Map<string, Interval[]>(ids.map((id) => [id, []]));
  if (ids.length === 0) return { businessHours, barbers, busyByBarber };

  const appts = await q.query<{ barber_id: string; start_at: Date; end_at: Date }>(
    `select barber_id, start_at, end_at from appointments
     where barber_id = any($1::uuid[]) and status = any($2::appointment_status[])
       and start_at < $3 and end_at > $4 and ($5::uuid is null or id <> $5::uuid)`,
    [ids, ACTIVE_STATUSES, dayEnd, dayStart, excludeAppointmentId ?? null],
  );
  const blocks = await q.query<{ barber_id: string | null; start_at: Date; end_at: Date }>(
    `select barber_id, start_at, end_at from blocked_slots
     where (barber_id is null or barber_id = any($1::uuid[])) and start_at < $2 and end_at > $3`,
    [ids, dayEnd, dayStart],
  );
  const push = (barberId: string, start: Date, end: Date) => {
    const iv = clipToDay(instantToLocal(start), instantToLocal(end), date);
    if (iv) busyByBarber.get(barberId)?.push(iv);
  };
  for (const a of appts.rows) push(a.barber_id, a.start_at, a.end_at);
  for (const b of blocks.rows) {
    if (b.barber_id) push(b.barber_id, b.start_at, b.end_at);
    else for (const id of ids) push(id, b.start_at, b.end_at);
  }
  return { businessHours, barbers, busyByBarber };
}

function workIntervalsFor(barber: BarberRow, date: string): Interval[] {
  const list = barber.working_hours?.[String(weekdayOf(date))] ?? [];
  return list
    .filter((x) => isHHMM(x.start) && isHHMM(x.end))
    .map((x) => ({ start: timeToMinutes(x.start), end: timeToMinutes(x.end) }))
    .filter((x) => x.end > x.start);
}

function validateDateWindow(date: string, settings: Settings, now: Date): BookingError | null {
  if (!isISODate(date)) return new BookingError("INVALID_INPUT", "Data inválida. Use o formato AAAA-MM-DD.");
  const today = todayLocal(now);
  if (date < today) return new BookingError("DATE_OUT_OF_RANGE", "Essa data já passou.");
  const max = addDays(today, settings.max_days_ahead);
  if (date > max)
    return new BookingError("DATE_OUT_OF_RANGE", `A agenda está aberta somente até ${max}.`, { max_date: max });
  return null;
}

function slotsForBarber(ctx: DayContext, barber: BarberRow, date: string, duration: number, settings: Settings, now: Date) {
  const nowLocal = instantToLocal(now);
  const earliest = date === nowLocal.date ? nowLocal.minutes + settings.min_notice_minutes : 0;
  return computeSlots({
    durationMinutes: duration,
    businessHours: ctx.businessHours,
    workIntervals: workIntervalsFor(barber, date),
    busy: ctx.busyByBarber.get(barber.id) ?? [],
    earliestStart: earliest,
    step: settings.slot_interval_minutes,
  }).map(minutesToTime);
}

export async function getAvailability(
  input: { serviceId: string; date: string; barberId?: string | null; now?: Date; excludeAppointmentId?: string },
  q: Queryable = db,
): Promise<AvailabilityResult> {
  const now = input.now ?? new Date();
  const settings = await getSettings(q);
  const dateErr = validateDateWindow(input.date, settings, now);
  if (dateErr) return { ok: false, code: dateErr.code, message: dateErr.message };

  const service = await getService(input.serviceId, q);
  if (!service || !service.active) return { ok: false, code: "SERVICE_NOT_FOUND", message: "Serviço não encontrado." };
  if (!service.duration_minutes)
    return {
      ok: false,
      code: "SERVICE_NOT_BOOKABLE",
      message: "Esse serviço ainda não tem duração cadastrada; não é possível consultar horários automaticamente.",
    };
  if (input.barberId && !isUuid(input.barberId))
    return { ok: false, code: "BARBER_NOT_FOUND", message: "Barbeiro não encontrado." };

  const ctx = await loadDayContext(q, input.date, input.barberId ? [input.barberId] : null, input.excludeAppointmentId);
  if (input.barberId && ctx.barbers.length === 0)
    return { ok: false, code: "BARBER_NOT_FOUND", message: "Barbeiro não encontrado ou inativo." };
  if (!ctx.businessHours)
    return { ok: false, code: "CLOSED", message: "A barbearia não tem funcionamento cadastrado para esse dia." };

  const barbers = ctx.barbers.map((b) => ({
    barber_id: b.id,
    barber_name: b.name,
    slots: slotsForBarber(ctx, b, input.date, service.duration_minutes!, settings, now),
  }));
  return { ok: true, date: input.date, service, barbers };
}

/* =============================== Clientes =============================== */

export async function upsertCustomer(phone: string, isTest: boolean, q: Queryable = db) {
  const { rows } = await q.query<{ id: string; name: string | null; phone: string; is_test: boolean }>(
    `insert into customers (phone, is_test) values ($1, $2)
     on conflict (phone) do update set phone = excluded.phone
     returning id, name, phone, is_test`,
    [phone, isTest],
  );
  return rows[0];
}

export async function setCustomerName(customerId: string, name: string, q: Queryable = db) {
  await q.query(`update customers set name = $2 where id = $1`, [customerId, name.trim().slice(0, 80)]);
}

/* ============================ Agendamentos ============================ */

const APPOINTMENT_SELECT = `
  select a.id, a.customer_id, coalesce(c.name, a.customer_name) as customer_name, c.phone as customer_phone,
         a.barber_id, b.name as barber_name, a.service_id, s.name as service_name,
         to_char(a.appointment_date, 'YYYY-MM-DD') as appointment_date,
         to_char(a.start_time, 'HH24:MI') as start_time, to_char(a.end_time, 'HH24:MI') as end_time,
         a.start_at, a.end_at, a.status, a.source, a.price, a.notes, a.is_test
  from appointments a
  join barbers b on b.id = a.barber_id
  join services s on s.id = a.service_id
  left join customers c on c.id = a.customer_id`;

function mapAppointment(r: Record<string, unknown>): AppointmentView {
  return { ...(r as unknown as AppointmentView), price: num(r.price) };
}

export async function getAppointment(id: string, q: Queryable = db): Promise<AppointmentView | null> {
  if (!isUuid(id)) return null;
  const { rows } = await q.query(`${APPOINTMENT_SELECT} where a.id = $1`, [id]);
  return rows[0] ? mapAppointment(rows[0]) : null;
}

export async function listAppointmentsBetween(
  fromDate: string,
  toDate: string,
  opts: { barberId?: string | null; includeCancelled?: boolean } = {},
  q: Queryable = db,
): Promise<AppointmentView[]> {
  const { rows } = await q.query(
    `${APPOINTMENT_SELECT}
     where a.appointment_date between $1 and $2
       and ($3::uuid is null or a.barber_id = $3::uuid)
       and ($4 or a.status not in ('cancelled'))
     order by a.start_at`,
    [fromDate, toDate, opts.barberId ?? null, Boolean(opts.includeCancelled)],
  );
  return rows.map(mapAppointment);
}

export async function listCustomerUpcoming(customerId: string, q: Queryable = db): Promise<AppointmentView[]> {
  const { rows } = await q.query(
    `${APPOINTMENT_SELECT}
     where a.customer_id = $1 and a.status in ('pending','confirmed') and a.end_at > now()
     order by a.start_at limit 10`,
    [customerId],
  );
  return rows.map(mapAppointment);
}

type CreateInput = {
  customerId: string | null;
  customerName?: string | null;
  serviceId: string;
  barberId?: string | null;
  date: string;
  time: string;
  source: AppointmentSource;
  status?: AppointmentStatus;
  isTest?: boolean;
  notes?: string | null;
  now?: Date;
};

/**
 * Cria um agendamento de forma transacional:
 *  1. trava a linha do barbeiro (serializa reservas concorrentes);
 *  2. recalcula a disponibilidade dentro da transação;
 *  3. insere — a restrição de exclusão do banco é a última barreira.
 */
export async function createAppointment(input: CreateInput): Promise<AppointmentView> {
  if (!isHHMM(input.time)) throw new BookingError("INVALID_INPUT", "Horário inválido. Use HH:MM.");
  const created = await withTransaction(async (tx) => {
    const availability = await getAvailability(
      { serviceId: input.serviceId, date: input.date, barberId: input.barberId ?? null, now: input.now },
      tx,
    );
    if (!availability.ok) throw new BookingError(availability.code, availability.message);
    const candidates = availability.barbers.filter((b) => b.slots.includes(input.time));
    if (candidates.length === 0) {
      throw new BookingError("SLOT_UNAVAILABLE", "Esse horário não está disponível.", {
        alternativas: availability.barbers.map((b) => ({ barbeiro: b.barber_name, horarios: b.slots.slice(0, 8) })),
      });
    }
    const barber = candidates[0];
    return insertLocked(tx, {
      ...input,
      barberId: barber.barber_id,
      durationMinutes: availability.service.duration_minutes!,
      price: availability.service.price,
      recheck: () =>
        getAvailability({ serviceId: input.serviceId, date: input.date, barberId: barber.barber_id, now: input.now }, tx),
    });
  });
  await scheduleNotifications(created).catch((err) => logEvent("error", "notifications.schedule", String(err)));
  return created;
}

async function insertLocked(
  tx: PoolClient,
  input: CreateInput & {
    barberId: string;
    durationMinutes: number;
    price: number | null;
    recheck?: () => Promise<AvailabilityResult>;
  },
): Promise<AppointmentView> {
  await tx.query(`select id from barbers where id = $1 for update`, [input.barberId]);
  // Após obter a trava, confirma novamente (outra transação pode ter reservado).
  if (input.recheck) {
    const again = await input.recheck();
    if (!again.ok || !again.barbers[0]?.slots.includes(input.time)) {
      throw new BookingError("SLOT_UNAVAILABLE", "Esse horário acabou de ser reservado por outra pessoa.");
    }
  }
  const startAt = localToInstant(input.date, input.time);
  const endAt = new Date(startAt.getTime() + input.durationMinutes * 60_000);
  const endLocal = instantToLocal(endAt);
  try {
    const { rows } = await tx.query<{ id: string }>(
      `insert into appointments
        (customer_id, customer_name, barber_id, service_id, appointment_date, start_time, end_time,
         start_at, end_at, status, source, price, notes, is_test)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) returning id`,
      [
        input.customerId,
        input.customerName ?? null,
        input.barberId,
        input.serviceId,
        input.date,
        input.time,
        endLocal.date === input.date ? endLocal.time : "23:59",
        startAt,
        endAt,
        input.status ?? "confirmed",
        input.source,
        input.price,
        input.notes ?? null,
        Boolean(input.isTest),
      ],
    );
    return (await getAppointment(rows[0].id, tx))!;
  } catch (err) {
    if (pgErrorCode(err) === PG_EXCLUSION_VIOLATION) {
      throw new BookingError("SLOT_UNAVAILABLE", "Esse horário conflita com outro atendimento do mesmo barbeiro.");
    }
    throw err;
  }
}

export async function cancelAppointment(
  id: string,
  opts: { reason?: string | null; customerId?: string; by: "customer" | "admin" },
): Promise<AppointmentView> {
  const appt = await getAppointment(id);
  if (!appt) throw new BookingError("APPOINTMENT_NOT_FOUND", "Agendamento não encontrado.");
  if (opts.customerId && appt.customer_id !== opts.customerId)
    throw new BookingError("NOT_ALLOWED", "Esse agendamento não pertence a este cliente.");
  if (!ACTIVE_STATUSES.includes(appt.status))
    throw new BookingError("CONFLICT", "Esse agendamento já não está ativo.");
  await db.query(
    `update appointments set status = 'cancelled', cancelled_at = now(), cancel_reason = $2 where id = $1`,
    [id, opts.reason ?? (opts.by === "customer" ? "Cancelado pelo cliente" : "Cancelado pela barbearia")],
  );
  await db.query(
    `update notification_jobs set status = 'cancelled' where appointment_id = $1 and status = 'pending' and kind <> 'cancellation'`,
    [id],
  );
  if (opts.by === "admin") await queueJob(id, "cancellation", new Date());
  return (await getAppointment(id))!;
}

export async function rescheduleAppointment(
  id: string,
  input: { date: string; time: string; barberId?: string | null; customerId?: string; now?: Date },
): Promise<AppointmentView> {
  if (!isHHMM(input.time)) throw new BookingError("INVALID_INPUT", "Horário inválido. Use HH:MM.");
  const updated = await withTransaction(async (tx) => {
    const { rows } = await tx.query(`${APPOINTMENT_SELECT} where a.id = $1 for update of a`, [id]);
    const appt = rows[0] ? mapAppointment(rows[0]) : null;
    if (!appt) throw new BookingError("APPOINTMENT_NOT_FOUND", "Agendamento não encontrado.");
    if (input.customerId && appt.customer_id !== input.customerId)
      throw new BookingError("NOT_ALLOWED", "Esse agendamento não pertence a este cliente.");
    if (!["pending", "confirmed"].includes(appt.status))
      throw new BookingError("CONFLICT", "Somente agendamentos ativos podem ser reagendados.");

    const availability = await getAvailability(
      {
        serviceId: appt.service_id,
        date: input.date,
        barberId: input.barberId ?? null,
        now: input.now,
        excludeAppointmentId: id,
      },
      tx,
    );
    if (!availability.ok) throw new BookingError(availability.code, availability.message);
    // Prefere manter o mesmo barbeiro quando nenhum foi indicado
    const ordered = [...availability.barbers].sort((a, b) =>
      a.barber_id === appt.barber_id ? -1 : b.barber_id === appt.barber_id ? 1 : 0,
    );
    const target = ordered.find((b) => b.slots.includes(input.time));
    if (!target)
      throw new BookingError("SLOT_UNAVAILABLE", "Esse horário não está disponível.", {
        alternativas: availability.barbers.map((b) => ({ barbeiro: b.barber_name, horarios: b.slots.slice(0, 8) })),
      });

    await tx.query(`select id from barbers where id = $1 for update`, [target.barber_id]);
    const startAt = localToInstant(input.date, input.time);
    const endAt = new Date(startAt.getTime() + availability.service.duration_minutes! * 60_000);
    try {
      await tx.query(
        `update appointments set barber_id = $2, appointment_date = $3, start_time = $4, end_time = $5,
           start_at = $6, end_at = $7 where id = $1`,
        [id, target.barber_id, input.date, input.time, instantToLocal(endAt).time, startAt, endAt],
      );
    } catch (err) {
      if (pgErrorCode(err) === PG_EXCLUSION_VIOLATION)
        throw new BookingError("SLOT_UNAVAILABLE", "Esse horário acabou de ser reservado por outra pessoa.");
      throw err;
    }
    return (await getAppointment(id, tx))!;
  });
  await scheduleNotifications(updated, { reset: true }).catch((err) =>
    logEvent("error", "notifications.schedule", String(err)),
  );
  return updated;
}

export async function setAppointmentStatus(id: string, status: AppointmentStatus) {
  try {
    await db.query(`update appointments set status = $2 where id = $1`, [id, status]);
  } catch (err) {
    if (pgErrorCode(err) === PG_EXCLUSION_VIOLATION)
      throw new BookingError("CONFLICT", "Não é possível reativar: o horário já está ocupado.");
    throw err;
  }
}

/* ===================== Atendimento presencial e bloqueios ===================== */

/**
 * Registra um atendimento presencial (ordem de chegada). Ocupa o intervalo do
 * barbeiro imediatamente; a restrição do banco impede sobreposição.
 */
export async function registerWalkIn(input: {
  barberId: string;
  serviceId: string;
  date: string;
  time: string;
  durationMinutes: number;
  customerName?: string | null;
  isTest?: boolean;
}): Promise<AppointmentView> {
  if (!isISODate(input.date) || !isHHMM(input.time)) throw new BookingError("INVALID_INPUT", "Data ou horário inválido.");
  if (!Number.isInteger(input.durationMinutes) || input.durationMinutes < 5 || input.durationMinutes > 480)
    throw new BookingError("INVALID_INPUT", "Duração deve estar entre 5 e 480 minutos.");
  const service = await getService(input.serviceId);
  if (!service) throw new BookingError("SERVICE_NOT_FOUND", "Serviço não encontrado.");
  return withTransaction((tx) =>
    insertLocked(tx, {
      customerId: null,
      customerName: input.customerName?.trim() || "Cliente presencial",
      serviceId: input.serviceId,
      barberId: input.barberId,
      date: input.date,
      time: input.time,
      source: "walk_in",
      status: "in_progress",
      isTest: input.isTest,
      durationMinutes: input.durationMinutes,
      price: service.price,
    }),
  );
}

export async function createBlock(input: {
  barberId: string | null;
  date: string;
  startTime: string;
  endTime: string;
  reason?: string | null;
  createdBy: string;
}) {
  if (!isISODate(input.date) || !isHHMM(input.startTime) || !isHHMM(input.endTime))
    throw new BookingError("INVALID_INPUT", "Data ou horário inválido.");
  if (input.endTime <= input.startTime) throw new BookingError("INVALID_INPUT", "O fim deve ser depois do início.");
  await db.query(
    `insert into blocked_slots (barber_id, start_at, end_at, reason, created_by) values ($1,$2,$3,$4,$5)`,
    [
      input.barberId,
      localToInstant(input.date, input.startTime),
      localToInstant(input.date, input.endTime),
      input.reason ?? null,
      input.createdBy,
    ],
  );
}

export async function listBlocksBetween(fromDate: string, toDate: string) {
  const { rows } = await db.query<{ id: string; barber_id: string | null; barber_name: string | null; start_at: Date; end_at: Date; reason: string | null }>(
    `select bs.id, bs.barber_id, b.name as barber_name, bs.start_at, bs.end_at, bs.reason
     from blocked_slots bs left join barbers b on b.id = bs.barber_id
     where bs.start_at < $2 and bs.end_at > $1 order by bs.start_at`,
    [localToInstant(fromDate, "00:00"), localToInstant(addDays(toDate, 1), "00:00")],
  );
  return rows;
}

export async function deleteBlock(id: string) {
  await db.query(`delete from blocked_slots where id = $1`, [id]);
}

/* ============================ Notificações ============================ */

async function queueJob(appointmentId: string, kind: string, when: Date, q: Queryable = db) {
  await q.query(
    `insert into notification_jobs (appointment_id, kind, scheduled_for) values ($1, $2, $3)
     on conflict (appointment_id, kind) do update
       set scheduled_for = excluded.scheduled_for, status = 'pending', attempts = 0, last_error = null, sent_at = null
       where notification_jobs.status <> 'sent' or $4`,
    [appointmentId, kind, when, kind.startsWith("reminder")],
  );
}

/** Agenda lembretes (24 h e 2 h antes) e, se não veio do WhatsApp, a confirmação. */
export async function scheduleNotifications(appt: AppointmentView, opts: { reset?: boolean } = {}) {
  if (!appt.customer_id || appt.source === "walk_in") return;
  const start = new Date(appt.start_at).getTime();
  const now = Date.now();
  const plans: [string, number][] = [
    ["reminder_24h", start - 24 * 3600_000],
    ["reminder_2h", start - 2 * 3600_000],
  ];
  for (const [kind, at] of plans) {
    if (at > now) await queueJob(appt.id, kind, new Date(at));
    else if (opts.reset)
      await db.query(`update notification_jobs set status = 'skipped', last_error = 'reagendado: prazo já passou' where appointment_id = $1 and kind = $2 and status = 'pending'`, [appt.id, kind]);
  }
  if (appt.source !== "whatsapp") await queueJob(appt.id, "confirmation", new Date());
}
