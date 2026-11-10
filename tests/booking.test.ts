import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  BookingError,
  cancelAppointment,
  createAppointment,
  createBlock,
  getAvailability,
  registerWalkIn,
  rescheduleAppointment,
} from "@/lib/server/booking";
import { db, getPool } from "@/lib/server/db";
import { makeCustomer, nextWeekday, resetScenario } from "./helpers";

let s: Awaited<ReturnType<typeof resetScenario>>;
const MONDAY = nextWeekday(1);
const TUESDAY = nextWeekday(2);
const SUNDAY = nextWeekday(0);

beforeEach(async () => {
  s = await resetScenario();
});
afterAll(async () => {
  await getPool().end();
});

async function slotsOf(date: string, serviceId = s.service30, barberId?: string) {
  const r = await getAvailability({ serviceId, date, barberId });
  if (!r.ok) throw new Error(r.message);
  return Object.fromEntries(r.barbers.map((b) => [b.barber_name, b.slots]));
}

describe("consulta de disponibilidade", () => {
  it("considera jornada, pausa e dias de cada barbeiro", async () => {
    const mon = await slotsOf(MONDAY);
    expect(mon["Barbeiro A TESTE"]).toContain("09:00");
    expect(mon["Barbeiro A TESTE"]).not.toContain("12:00");
    expect(mon["Barbeiro B TESTE"]).toEqual([]); // B só atende terça
    const tue = await slotsOf(TUESDAY);
    expect(tue["Barbeiro B TESTE"][0]).toBe("13:00");
    expect(tue["Barbeiro B TESTE"].at(-1)).toBe("16:30");
  });

  it("dia sem funcionamento cadastrado retorna fechado", async () => {
    const r = await getAvailability({ serviceId: s.service30, date: SUNDAY });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("CLOSED");
  });

  it("serviço sem duração não pode ser agendado automaticamente", async () => {
    const r = await getAvailability({ serviceId: s.serviceNoDuration, date: MONDAY });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("SERVICE_NOT_BOOKABLE");
  });

  it("data passada ou fora da janela é recusada", async () => {
    expect((await getAvailability({ serviceId: s.service30, date: "2020-01-01" })).ok).toBe(false);
    expect((await getAvailability({ serviceId: s.service30, date: "2099-01-01" })).ok).toBe(false);
  });
});

describe("agendamento", () => {
  it("cria e remove o horário da disponibilidade (inclusive por duração)", async () => {
    const c = await makeCustomer();
    const appt = await createAppointment({
      customerId: c,
      serviceId: s.service60,
      barberId: s.barberA,
      date: MONDAY,
      time: "10:00",
      source: "whatsapp",
      isTest: true,
    });
    expect(appt).toMatchObject({ start_time: "10:00", end_time: "11:00", status: "confirmed", price: 60 });
    const after = (await slotsOf(MONDAY, s.service30))["Barbeiro A TESTE"];
    expect(after).not.toContain("10:00");
    expect(after).not.toContain("10:30");
    expect(after).toContain("11:00");
    // serviço de 60 min às 09:30 colidiria com 10:00–11:00
    expect((await slotsOf(MONDAY, s.service60))["Barbeiro A TESTE"]).not.toContain("09:30");
  });

  it("impede reserva duplicada do mesmo horário", async () => {
    const c1 = await makeCustomer("5579911110001");
    const c2 = await makeCustomer("5579911110002");
    const base = { serviceId: s.service30, barberId: s.barberA, date: MONDAY, time: "15:00", source: "whatsapp" as const };
    await createAppointment({ ...base, customerId: c1 });
    await expect(createAppointment({ ...base, customerId: c2 })).rejects.toMatchObject({ code: "SLOT_UNAVAILABLE" });
  });

  it("requisições simultâneas: só uma reserva vence", async () => {
    const customers = await Promise.all([1, 2, 3, 4, 5, 6].map((i) => makeCustomer(`557991111000${i}`)));
    const results = await Promise.allSettled(
      customers.map((c) =>
        createAppointment({ customerId: c, serviceId: s.service30, barberId: s.barberA, date: MONDAY, time: "16:00", source: "whatsapp" }),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const { rows } = await db.query(`select count(*)::int as n from appointments where status <> 'cancelled'`);
    expect(rows[0].n).toBe(1);
  });

  it("o banco rejeita sobreposição mesmo inserindo direto (restrição de exclusão)", async () => {
    await createAppointment({ customerId: null, serviceId: s.service60, barberId: s.barberA, date: MONDAY, time: "09:00", source: "admin" });
    await expect(
      db.query(
        `insert into appointments (barber_id, service_id, appointment_date, start_time, end_time, start_at, end_at, source)
         select barber_id, service_id, appointment_date, '09:30', '10:00', start_at + interval '30 min', start_at + interval '60 min', 'admin'
         from appointments limit 1`,
      ),
    ).rejects.toMatchObject({ code: "23P01" });
  });

  it("sem preferência escolhe um barbeiro livre", async () => {
    const c = await makeCustomer();
    await createAppointment({ customerId: c, serviceId: s.service30, barberId: s.barberA, date: TUESDAY, time: "14:00", source: "admin" });
    const second = await createAppointment({ customerId: c, serviceId: s.service30, date: TUESDAY, time: "14:00", source: "whatsapp" });
    expect(second.barber_name).toBe("Barbeiro B TESTE");
  });

  it("agenda lembretes de 24 h e 2 h", async () => {
    const c = await makeCustomer();
    const appt = await createAppointment({ customerId: c, serviceId: s.service30, barberId: s.barberA, date: MONDAY, time: "09:00", source: "whatsapp" });
    const { rows } = await db.query(`select kind from notification_jobs where appointment_id = $1 order by kind`, [appt.id]);
    expect(rows.map((r) => r.kind)).toEqual(["reminder_24h", "reminder_2h"]);
  });
});

describe("cancelamento e reagendamento", () => {
  it("cancela e libera o horário; cliente não cancela agendamento alheio", async () => {
    const owner = await makeCustomer("5579911110010");
    const other = await makeCustomer("5579911110011");
    const appt = await createAppointment({ customerId: owner, serviceId: s.service30, barberId: s.barberA, date: MONDAY, time: "17:00", source: "whatsapp" });
    await expect(cancelAppointment(appt.id, { customerId: other, by: "customer" })).rejects.toMatchObject({ code: "NOT_ALLOWED" });
    const cancelled = await cancelAppointment(appt.id, { customerId: owner, by: "customer" });
    expect(cancelled.status).toBe("cancelled");
    expect((await slotsOf(MONDAY))["Barbeiro A TESTE"]).toContain("17:00");
    const { rows } = await db.query(`select distinct status from notification_jobs where appointment_id = $1`, [appt.id]);
    expect(rows.map((r) => r.status)).toEqual(["cancelled"]);
  });

  it("reagenda mantendo o barbeiro e recusa horário ocupado", async () => {
    const c = await makeCustomer();
    const a1 = await createAppointment({ customerId: c, serviceId: s.service30, barberId: s.barberA, date: MONDAY, time: "09:00", source: "whatsapp" });
    await createAppointment({ customerId: null, serviceId: s.service30, barberId: s.barberA, date: MONDAY, time: "10:00", source: "admin" });
    await expect(rescheduleAppointment(a1.id, { date: MONDAY, time: "10:00", barberId: s.barberA, customerId: c })).rejects.toBeInstanceOf(BookingError);
    const moved = await rescheduleAppointment(a1.id, { date: MONDAY, time: "09:15", customerId: c });
    expect(moved).toMatchObject({ start_time: "09:15", barber_name: "Barbeiro A TESTE" });
  });
});

describe("atendimento presencial e bloqueios", () => {
  it("atendimento presencial ocupa a agenda que a IA consulta", async () => {
    await registerWalkIn({ barberId: s.barberA, serviceId: s.service30, date: MONDAY, time: "14:00", durationMinutes: 45 });
    const slots = (await slotsOf(MONDAY))["Barbeiro A TESTE"];
    expect(slots).not.toContain("14:00");
    expect(slots).not.toContain("14:30");
    expect(slots).toContain("14:45");
  });

  it("presencial sobreposto a um agendamento é recusado", async () => {
    await createAppointment({ customerId: null, serviceId: s.service30, barberId: s.barberA, date: MONDAY, time: "15:00", source: "admin" });
    await expect(
      registerWalkIn({ barberId: s.barberA, serviceId: s.service30, date: MONDAY, time: "14:45", durationMinutes: 30 }),
    ).rejects.toMatchObject({ code: "SLOT_UNAVAILABLE" });
  });

  it("bloqueio manual (de um barbeiro ou de todos) remove horários", async () => {
    await createBlock({ barberId: s.barberA, date: MONDAY, startTime: "09:00", endTime: "10:00", reason: "Teste", createdBy: "teste" });
    expect((await slotsOf(MONDAY))["Barbeiro A TESTE"][0]).toBe("10:00");
    await createBlock({ barberId: null, date: TUESDAY, startTime: "13:00", endTime: "19:00", reason: "Fechado à tarde", createdBy: "teste" });
    const tue = await slotsOf(TUESDAY);
    expect(tue["Barbeiro B TESTE"]).toEqual([]);
    expect(tue["Barbeiro A TESTE"].every((t) => t < "13:00")).toBe(true);
  });
});
