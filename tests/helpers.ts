import { db } from "@/lib/server/db";
import { addDays, todayLocal, weekdayOf } from "@/lib/time";

/** Próxima data (a partir de amanhã+2) que cai no dia da semana pedido. */
export function nextWeekday(dow: number): string {
  let d = addDays(todayLocal(), 2);
  while (weekdayOf(d) !== dow) d = addDays(d, 1);
  return d;
}

/** Limpa os dados operacionais e cadastra um cenário fictício conhecido. */
export async function resetScenario() {
  await db.query(
    `truncate appointments, blocked_slots, messages, conversations, customers, notification_jobs, event_logs restart identity cascade`,
  );
  await db.query(`delete from barbers`);
  await db.query(`delete from services`);
  await db.query(`delete from business_hours`);
  await db.query(`update settings set value = '"test"' where key = 'whatsapp_mode'`);
  await db.query(`update settings set value = '""' where key = 'test_recipient'`);
  await db.query(`update settings set value = 'true' where key = 'ai_enabled'`);
  for (let dow = 1; dow <= 6; dow++) {
    await db.query(`insert into business_hours (day_of_week, opening_time, closing_time) values ($1, '09:00', '19:00')`, [dow]);
  }
  const s30 = await db.query<{ id: string }>(
    `insert into services (name, price, duration_minutes, active) values ('Corte TESTE', 40, 30, true) returning id`,
  );
  const s60 = await db.query<{ id: string }>(
    `insert into services (name, price, duration_minutes, active) values ('Corte + Barba TESTE', 60, 60, true) returning id`,
  );
  const sNoDuration = await db.query<{ id: string }>(
    `insert into services (name, price, duration_minutes, active) values ('Sem duração TESTE', null, null, true) returning id`,
  );
  const hours = JSON.stringify(
    Object.fromEntries(
      [1, 2, 3, 4, 5, 6].map((d) => [String(d), [{ start: "09:00", end: "12:00" }, { start: "13:00", end: "19:00" }]]),
    ),
  );
  const a = await db.query<{ id: string }>(
    `insert into barbers (name, working_hours, sort_order) values ('Barbeiro A TESTE', $1, 1) returning id`,
    [hours],
  );
  const b = await db.query<{ id: string }>(
    `insert into barbers (name, working_hours, sort_order) values ('Barbeiro B TESTE', $1, 2) returning id`,
    [JSON.stringify({ "2": [{ start: "13:00", end: "17:00" }] })],
  );
  return {
    service30: s30.rows[0].id,
    service60: s60.rows[0].id,
    serviceNoDuration: sNoDuration.rows[0].id,
    barberA: a.rows[0].id,
    barberB: b.rows[0].id,
  };
}

export async function makeCustomer(phone = "5579911112222", name: string | null = null) {
  const { rows } = await db.query<{ id: string }>(
    `insert into customers (phone, name, is_test) values ($1, $2, true) returning id`,
    [phone, name],
  );
  return rows[0].id;
}
