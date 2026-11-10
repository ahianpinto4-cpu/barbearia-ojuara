"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { login, logout, requireAdmin } from "@/lib/server/auth";
import {
  BookingError,
  cancelAppointment,
  createAppointment,
  createBlock,
  deleteBlock,
  registerWalkIn,
  rescheduleAppointment,
  setAppointmentStatus,
  upsertCustomer,
} from "@/lib/server/booking";
import {
  getConversation,
  markConversationRead,
  sendToConversation,
  setConversationStatus,
} from "@/lib/server/conversations";
import { db } from "@/lib/server/db";
import { logEvent } from "@/lib/server/log";
import { getSettings, setSetting, type ReminderTemplates } from "@/lib/server/settings";
import { digitsOnly, validateRecipient } from "@/lib/phone";
import { handleInboundMessage } from "@/lib/whatsapp/processor";
import { SIMULATOR_PHONE } from "@/lib/whatsapp/config";

/* --------------------------------- Utilitários --------------------------------- */

function back(path: string, kind: "ok" | "erro", message: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}${kind}=${encodeURIComponent(message)}`);
}

function errMessage(err: unknown): string {
  if (err instanceof BookingError) return err.message;
  if (err instanceof z.ZodError) return err.issues.map((i) => i.message).join(" ");
  console.error(err);
  return "Não foi possível concluir a operação. Tente novamente.";
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const optUuid = (v: string) => (v ? v : null);
const returnTo = (fd: FormData, fallback: string) => {
  const r = str(fd, "returnTo");
  return r.startsWith("/admin") ? r : fallback;
};

/* ----------------------------------- Login ----------------------------------- */

export async function loginAction(_prev: { error?: string; email?: string } | undefined, fd: FormData) {
  const res = await login(str(fd, "email"), String(fd.get("password") ?? ""));
  if (!res.ok) return { error: res.error, email: str(fd, "email") };
  redirect("/admin");
}

export async function logoutAction() {
  await logout();
  redirect("/admin/login");
}

/* ---------------------------------- Agenda ---------------------------------- */

const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
const dateRe = /^\d{4}-\d{2}-\d{2}$/;

export async function createAdminAppointmentAction(fd: FormData) {
  const admin = await requireAdmin();
  const path = returnTo(fd, "/admin/agenda");
  let msg: string;
  try {
    const data = z
      .object({
        serviceId: z.string().uuid("Escolha o serviço."),
        barberId: z.string(),
        date: z.string().regex(dateRe, "Data inválida."),
        time: z.string().regex(timeRe, "Horário inválido."),
        name: z.string().min(2, "Informe o nome do cliente."),
        phone: z.string(),
      })
      .parse({
        serviceId: str(fd, "serviceId"),
        barberId: str(fd, "barberId"),
        date: str(fd, "date"),
        time: str(fd, "time"),
        name: str(fd, "name"),
        phone: str(fd, "phone"),
      });
    const settings = await getSettings();
    let customerId: string | null = null;
    if (data.phone) {
      const v = validateRecipient(data.phone.startsWith("55") ? data.phone : `55${digitsOnly(data.phone)}`);
      if (!v.ok) throw new BookingError("INVALID_INPUT", `Telefone: ${v.reason}`);
      const c = await upsertCustomer(v.phone, settings.whatsapp_mode === "test");
      await db.query(`update customers set name = coalesce(name, $2) where id = $1`, [c.id, data.name]);
      customerId = c.id;
    }
    const appt = await createAppointment({
      customerId,
      customerName: data.name,
      serviceId: data.serviceId,
      barberId: optUuid(data.barberId),
      date: data.date,
      time: data.time,
      source: "admin",
      isTest: settings.whatsapp_mode === "test",
      notes: `Criado por ${admin.name}`,
    });
    msg = `Agendamento criado: ${appt.customer_name ?? "cliente"} às ${appt.start_time} com ${appt.barber_name}.`;
  } catch (err) {
    back(path, "erro", errMessage(err));
  }
  revalidatePath("/admin", "layout");
  back(path, "ok", msg);
}

export async function walkInAction(fd: FormData) {
  await requireAdmin();
  const path = returnTo(fd, "/admin/agenda");
  let msg: string;
  try {
    const appt = await registerWalkIn({
      barberId: z.string().uuid("Escolha o profissional.").parse(str(fd, "barberId")),
      serviceId: z.string().uuid("Escolha o serviço.").parse(str(fd, "serviceId")),
      date: str(fd, "date"),
      time: str(fd, "time"),
      durationMinutes: Number(str(fd, "duration")),
      customerName: str(fd, "name") || null,
      isTest: (await getSettings()).whatsapp_mode === "test",
    });
    msg = `Atendimento presencial registrado: ${appt.start_time}–${appt.end_time} com ${appt.barber_name}. A IA não oferecerá esse intervalo.`;
  } catch (err) {
    back(path, "erro", errMessage(err));
  }
  revalidatePath("/admin", "layout");
  back(path, "ok", msg);
}

export async function blockAction(fd: FormData) {
  const admin = await requireAdmin();
  const path = returnTo(fd, "/admin/agenda");
  try {
    await createBlock({
      barberId: optUuid(str(fd, "barberId")),
      date: str(fd, "date"),
      startTime: str(fd, "start"),
      endTime: str(fd, "end"),
      reason: str(fd, "reason") || null,
      createdBy: admin.email,
    });
  } catch (err) {
    back(path, "erro", errMessage(err));
  }
  revalidatePath("/admin", "layout");
  back(path, "ok", "Horário bloqueado.");
}

export async function deleteBlockAction(fd: FormData) {
  await requireAdmin();
  await deleteBlock(z.string().uuid().parse(str(fd, "id")));
  revalidatePath("/admin", "layout");
  back(returnTo(fd, "/admin/agenda"), "ok", "Bloqueio removido.");
}

export async function appointmentStatusAction(fd: FormData) {
  const admin = await requireAdmin();
  const path = returnTo(fd, "/admin/agenda");
  const id = z.string().uuid().parse(str(fd, "id"));
  const status = z.enum(["confirmed", "completed", "no_show", "cancelled", "in_progress"]).parse(str(fd, "status"));
  try {
    if (status === "cancelled") await cancelAppointment(id, { by: "admin", reason: `Cancelado por ${admin.name}` });
    else await setAppointmentStatus(id, status);
  } catch (err) {
    back(path, "erro", errMessage(err));
  }
  revalidatePath("/admin", "layout");
  back(path, "ok", "Agendamento atualizado.");
}

export async function rescheduleAction(fd: FormData) {
  await requireAdmin();
  const path = returnTo(fd, "/admin/agenda");
  try {
    await rescheduleAppointment(z.string().uuid().parse(str(fd, "id")), {
      date: z.string().regex(dateRe, "Data inválida.").parse(str(fd, "date")),
      time: z.string().regex(timeRe, "Horário inválido.").parse(str(fd, "time")),
      barberId: optUuid(str(fd, "barberId")),
    });
  } catch (err) {
    back(path, "erro", errMessage(err));
  }
  revalidatePath("/admin", "layout");
  back(path, "ok", "Agendamento reagendado.");
}

/* --------------------------------- Serviços --------------------------------- */

export async function saveServiceAction(fd: FormData) {
  await requireAdmin();
  const path = "/admin/servicos";
  try {
    const data = z
      .object({
        id: z.string(),
        name: z.string().min(2, "Informe o nome."),
        description: z.string().max(400),
        price: z.string(),
        duration: z.string(),
        sortOrder: z.coerce.number().int().default(0),
        active: z.boolean(),
      })
      .parse({
        id: str(fd, "id"),
        name: str(fd, "name"),
        description: str(fd, "description"),
        price: str(fd, "price").replace(",", "."),
        duration: str(fd, "duration"),
        sortOrder: str(fd, "sortOrder") || 0,
        active: fd.get("active") === "on",
      });
    const price = data.price === "" ? null : Number(data.price);
    const duration = data.duration === "" ? null : Number(data.duration);
    if (price !== null && (!Number.isFinite(price) || price < 0)) throw new BookingError("INVALID_INPUT", "Preço inválido.");
    if (duration !== null && (!Number.isInteger(duration) || duration < 5 || duration > 480))
      throw new BookingError("INVALID_INPUT", "Duração deve ser um número inteiro entre 5 e 480 minutos.");
    if (data.active && duration === null)
      throw new BookingError("INVALID_INPUT", "Para ativar o serviço, informe a duração (necessária para calcular horários).");
    if (data.id) {
      await db.query(
        `update services set name=$2, description=$3, price=$4, duration_minutes=$5, active=$6, sort_order=$7 where id=$1`,
        [data.id, data.name, data.description || null, price, duration, data.active, data.sortOrder],
      );
    } else {
      await db.query(
        `insert into services (name, description, price, duration_minutes, active, sort_order) values ($1,$2,$3,$4,$5,$6)`,
        [data.name, data.description || null, price, duration, data.active, data.sortOrder],
      );
    }
  } catch (err) {
    back(path, "erro", errMessage(err));
  }
  revalidatePath("/", "layout");
  back(path, "ok", "Serviço salvo.");
}

export async function deleteServiceAction(fd: FormData) {
  await requireAdmin();
  await db.query(`update services set deleted_at = now(), active = false where id = $1`, [z.string().uuid().parse(str(fd, "id"))]);
  revalidatePath("/", "layout");
  back("/admin/servicos", "ok", "Serviço removido (exclusão lógica; histórico preservado).");
}

/* --------------------------------- Barbeiros --------------------------------- */

const DAYS = [0, 1, 2, 3, 4, 5, 6];

function parseWorkingHours(fd: FormData) {
  const wh: Record<string, { start: string; end: string }[]> = {};
  for (const d of DAYS) {
    const list: { start: string; end: string }[] = [];
    for (const shift of [1, 2]) {
      const start = str(fd, `d${d}_s${shift}_start`);
      const end = str(fd, `d${d}_s${shift}_end`);
      if (!start && !end) continue;
      if (!timeRe.test(start) || !timeRe.test(end) || end <= start)
        throw new BookingError("INVALID_INPUT", "Confira os horários: cada turno precisa de início e fim válidos.");
      list.push({ start, end });
    }
    if (list.length === 2 && list[1].start < list[0].end)
      throw new BookingError("INVALID_INPUT", "O segundo turno deve começar depois do fim do primeiro.");
    if (list.length) wh[String(d)] = list;
  }
  return wh;
}

export async function saveBarberAction(fd: FormData) {
  await requireAdmin();
  const path = "/admin/barbeiros";
  try {
    const id = str(fd, "id");
    const name = z.string().min(2, "Informe o nome.").max(60).parse(str(fd, "name"));
    const active = fd.get("active") === "on";
    const wh = JSON.stringify(parseWorkingHours(fd));
    const sortOrder = Number(str(fd, "sortOrder") || 0);
    if (id) await db.query(`update barbers set name=$2, active=$3, working_hours=$4, sort_order=$5 where id=$1`, [id, name, active, wh, sortOrder]);
    else await db.query(`insert into barbers (name, active, working_hours, sort_order) values ($1,$2,$3,$4)`, [name, active, wh, sortOrder]);
  } catch (err) {
    back(path, "erro", errMessage(err));
  }
  revalidatePath("/admin", "layout");
  back(path, "ok", "Barbeiro salvo.");
}

export async function deleteBarberAction(fd: FormData) {
  await requireAdmin();
  await db.query(`update barbers set deleted_at = now(), active = false where id = $1`, [z.string().uuid().parse(str(fd, "id"))]);
  revalidatePath("/admin", "layout");
  back("/admin/barbeiros", "ok", "Barbeiro removido (histórico preservado).");
}

/* ------------------------------- Conversas ------------------------------- */

export async function conversationAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = z.string().uuid().parse(str(fd, "id"));
  const op = z.enum(["assume", "pause", "resume", "read"]).parse(str(fd, "op"));
  const path = `/admin/conversas/${id}`;
  if (op === "assume") await setConversationStatus(id, "HUMAN_ACTIVE", { assignedTo: admin.name, needsAttention: false });
  if (op === "pause") await setConversationStatus(id, "AI_PAUSED", { assignedTo: admin.name });
  if (op === "resume") await setConversationStatus(id, "AI_RESUMED", { assignedTo: null, needsAttention: false });
  await markConversationRead(id);
  await logEvent("info", "conversation.admin_action", `${admin.email}: ${op}`, { conversation: id });
  revalidatePath("/admin", "layout");
  back(path, "ok", { assume: "Você assumiu a conversa. A IA está pausada.", pause: "IA pausada.", resume: "IA reativada.", read: "Marcada como lida." }[op]);
}

export async function sendHumanMessageAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = z.string().uuid().parse(str(fd, "id"));
  const path = `/admin/conversas/${id}`;
  const text = str(fd, "text");
  if (!text) back(path, "erro", "Escreva a mensagem.");
  const conv = await getConversation(id);
  if (!conv) back("/admin/conversas", "erro", "Conversa não encontrada.");
  // Ao responder manualmente, a conversa passa a ser humana (a IA não interfere).
  if (conv.status !== "HUMAN_ACTIVE") await setConversationStatus(id, "HUMAN_ACTIVE", { assignedTo: admin.name, needsAttention: false });
  const res = await sendToConversation(conv, text.slice(0, 4000), "human", { simulate: conv.customer_phone === SIMULATOR_PHONE });
  await markConversationRead(id);
  revalidatePath("/admin", "layout");
  if (!res.ok) back(path, "erro", `Mensagem não enviada: ${res.reason}`);
  back(path, "ok", "Mensagem enviada.");
}

/* ------------------------------ Simulador ------------------------------ */

export async function simulateMessageAction(fd: FormData) {
  await requireAdmin();
  const text = str(fd, "text");
  if (!text) back("/admin/simulador", "erro", "Escreva uma mensagem.");
  await handleInboundMessage(
    { id: `sim-${Date.now()}`, from: SIMULATOR_PHONE, timestamp: Date.now() / 1000, type: "text", text: text.slice(0, 2000), profileName: "Simulador" },
    { simulate: true },
  );
  revalidatePath("/admin", "layout");
  redirect("/admin/simulador");
}

export async function resetSimulatorAction() {
  await requireAdmin();
  await db.query(
    `delete from appointments where customer_id in (select id from customers where phone = $1)`,
    [SIMULATOR_PHONE],
  );
  await db.query(`delete from customers where phone = $1`, [SIMULATOR_PHONE]);
  revalidatePath("/admin", "layout");
  back("/admin/simulador", "ok", "Simulação reiniciada.");
}

/* ---------------------------- Configurações ---------------------------- */

export async function saveWhatsappSettingsAction(fd: FormData) {
  const admin = await requireAdmin();
  const path = "/admin/configuracoes";
  if (admin.role !== "owner") back(path, "erro", "Somente o responsável (owner) altera o modo de operação.");
  const mode = z.enum(["test", "production"]).parse(str(fd, "mode"));
  const testRaw = digitsOnly(str(fd, "testRecipient"));
  const prodRaw = digitsOnly(str(fd, "productionRecipient"));
  if (testRaw) {
    const v = validateRecipient(testRaw);
    if (!v.ok) back(path, "erro", `Número de teste: ${v.reason}`);
  }
  const prod = validateRecipient(prodRaw);
  if (!prod.ok) back(path, "erro", `Número oficial: ${prod.reason}`);
  if (mode === "test" && !testRaw) {
    // Permitido salvar, mas nenhum envio acontece até o número completo ser informado.
  }
  await setSetting("test_recipient", testRaw);
  await setSetting("production_recipient", prodRaw);
  await setSetting("whatsapp_mode", mode);
  await logEvent("warn", "settings.whatsapp_mode", `${admin.email} definiu modo ${mode}`);
  revalidatePath("/admin", "layout");
  back(path, "ok", mode === "production" ? "Modo PRODUÇÃO ativo: o assistente responde a todos os clientes." : "Modo TESTE ativo.");
}

export async function saveAssistantSettingsAction(fd: FormData) {
  await requireAdmin();
  await setSetting("ai_enabled", fd.get("aiEnabled") === "on");
  await setSetting("greeting_message", str(fd, "greeting").slice(0, 1000));
  await setSetting("handoff_message", str(fd, "handoff").slice(0, 500) || "Um atendente vai continuar a conversa com você por aqui.");
  await setSetting("assistant_extra_instructions", str(fd, "extra").slice(0, 2000));
  const n = (k: string, min: number, max: number, def: number) => {
    const v = Number(str(fd, k));
    return Number.isInteger(v) && v >= min && v <= max ? v : def;
  };
  await setSetting("slot_interval_minutes", n("slotInterval", 5, 120, 15));
  await setSetting("min_notice_minutes", n("minNotice", 0, 1440, 60));
  await setSetting("max_days_ahead", n("maxDays", 1, 180, 30));
  revalidatePath("/admin", "layout");
  back("/admin/configuracoes", "ok", "Configurações do assistente salvas.");
}

export async function saveTemplatesAction(fd: FormData) {
  await requireAdmin();
  const t = (k: string) => {
    const v = str(fd, k);
    if (v && !/^[a-z0-9_]{1,512}$/.test(v)) back("/admin/configuracoes", "erro", `Nome de template inválido: ${v}`);
    return v || null;
  };
  const templates: ReminderTemplates = {
    confirmation: t("confirmation"),
    reminder_24h: t("reminder_24h"),
    reminder_2h: t("reminder_2h"),
    cancellation: t("cancellation"),
    admin_alert: t("admin_alert"),
    language: str(fd, "language") || "pt_BR",
  };
  await setSetting("reminder_templates", templates);
  back("/admin/configuracoes", "ok", "Templates salvos.");
}

export async function saveBusinessHoursAction(fd: FormData) {
  await requireAdmin();
  const path = "/admin/configuracoes";
  try {
    for (const d of DAYS) {
      const open = str(fd, `open_${d}`);
      const close = str(fd, `close_${d}`);
      const active = fd.get(`active_${d}`) === "on";
      if (!active && !open && !close) {
        await db.query(`delete from business_hours where day_of_week = $1`, [d]);
        continue;
      }
      if (!timeRe.test(open) || !timeRe.test(close) || close <= open)
        throw new BookingError("INVALID_INPUT", "Horário de funcionamento inválido: confira abertura e fechamento.");
      await db.query(
        `insert into business_hours (day_of_week, opening_time, closing_time, active) values ($1,$2,$3,$4)
         on conflict (day_of_week) do update set opening_time = excluded.opening_time, closing_time = excluded.closing_time, active = excluded.active`,
        [d, open, close, active],
      );
    }
  } catch (err) {
    back(path, "erro", errMessage(err));
  }
  revalidatePath("/", "layout");
  back(path, "ok", "Horário de funcionamento salvo.");
}

export async function purgeTestDataAction() {
  const admin = await requireAdmin();
  if (admin.role !== "owner") back("/admin/configuracoes", "erro", "Somente o responsável pode apagar dados de teste.");
  await db.query(`delete from appointments where is_test`);
  await db.query(`delete from customers where is_test`);
  await logEvent("warn", "settings.purge_test", `${admin.email} apagou os dados de teste`);
  revalidatePath("/admin", "layout");
  back("/admin/configuracoes", "ok", "Dados de teste apagados.");
}
