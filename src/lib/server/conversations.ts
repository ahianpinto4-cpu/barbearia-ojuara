import { db, type Queryable } from "./db";
import { logEvent, maskPhone } from "./log";
import { getSettings } from "./settings";
import { sendTemplate, sendText } from "@/lib/whatsapp/client";
import { adminAlertRecipient, canSendTo, resolveMode } from "@/lib/whatsapp/config";

export type ConversationStatus = "AI_ACTIVE" | "HUMAN_REQUESTED" | "HUMAN_ACTIVE" | "AI_PAUSED" | "AI_RESUMED";

/** Estados em que a IA NÃO responde automaticamente. */
export const AI_SILENT_STATUSES: ConversationStatus[] = ["HUMAN_REQUESTED", "HUMAN_ACTIVE", "AI_PAUSED"];

export type ConversationRow = {
  id: string;
  customer_id: string;
  customer_name: string | null;
  customer_phone: string;
  status: ConversationStatus;
  assigned_to: string | null;
  last_message_at: Date | null;
  last_inbound_at: Date | null;
  unread_count: number;
  needs_attention: boolean;
  handoff_reason: string | null;
  is_test: boolean;
};

export type MessageRow = {
  id: string;
  direction: "inbound" | "outbound";
  sender: "customer" | "ai" | "human" | "system";
  content: string;
  status: string;
  whatsapp_message_id: string | null;
  created_at: Date;
};

const CONV_SELECT = `
  select cv.id, cv.customer_id, c.name as customer_name, c.phone as customer_phone, cv.status, cv.assigned_to,
         cv.last_message_at, cv.last_inbound_at, cv.unread_count, cv.needs_attention, cv.handoff_reason, cv.is_test
  from conversations cv join customers c on c.id = cv.customer_id`;

export async function getOrCreateConversation(customerId: string, isTest: boolean, q: Queryable = db) {
  await q.query(
    `insert into conversations (customer_id, is_test) values ($1, $2) on conflict (customer_id) do nothing`,
    [customerId, isTest],
  );
  const { rows } = await q.query<ConversationRow>(`${CONV_SELECT} where cv.customer_id = $1`, [customerId]);
  return rows[0];
}

export async function getConversation(id: string, q: Queryable = db) {
  const { rows } = await q.query<ConversationRow>(`${CONV_SELECT} where cv.id = $1`, [id]);
  return rows[0] ?? null;
}

export async function listConversations(limit = 100) {
  const { rows } = await db.query<ConversationRow & { last_message: string | null }>(
    `${CONV_SELECT.replace("cv.is_test", "cv.is_test, (select content from messages m where m.conversation_id = cv.id order by created_at desc limit 1) as last_message")}
     order by cv.needs_attention desc, cv.last_message_at desc nulls last limit $1`,
    [limit],
  );
  return rows;
}

export async function getMessages(conversationId: string, limit = 60) {
  const { rows } = await db.query<MessageRow>(
    `select * from (select id, direction, sender, content, status, whatsapp_message_id, created_at
       from messages where conversation_id = $1 order by created_at desc limit $2) t order by created_at`,
    [conversationId, limit],
  );
  return rows;
}

/** Grava mensagem recebida. Retorna null se for duplicada (mesmo id do WhatsApp). */
export async function insertInbound(conversationId: string, content: string, waId: string | null, type = "text") {
  const { rows } = await db.query<{ id: string }>(
    `insert into messages (conversation_id, direction, sender, content, message_type, whatsapp_message_id, status)
     values ($1, 'inbound', 'customer', $2, $3, $4, 'received')
     on conflict (whatsapp_message_id) do nothing returning id`,
    [conversationId, content, type, waId],
  );
  if (!rows[0]) return null;
  await db.query(
    `update conversations set last_message_at = now(), last_inbound_at = now(), unread_count = unread_count + 1 where id = $1`,
    [conversationId],
  );
  return rows[0].id;
}

export async function insertOutbound(
  conversationId: string,
  sender: "ai" | "human" | "system",
  content: string,
  status: string,
  waId: string | null,
  error?: unknown,
) {
  await db.query(
    `insert into messages (conversation_id, direction, sender, content, whatsapp_message_id, status, error)
     values ($1, 'outbound', $2, $3, $4, $5, $6)`,
    [conversationId, sender, content, waId, status, error ? JSON.stringify(error) : null],
  );
  await db.query(`update conversations set last_message_at = now() where id = $1`, [conversationId]);
}

export async function setConversationStatus(
  id: string,
  status: ConversationStatus,
  opts: { assignedTo?: string | null; reason?: string | null; needsAttention?: boolean } = {},
) {
  await db.query(
    `update conversations set status = $2,
       assigned_to = case when $3::boolean then $4 else assigned_to end,
       handoff_reason = coalesce($5, handoff_reason),
       needs_attention = coalesce($6, needs_attention)
     where id = $1`,
    [id, status, opts.assignedTo !== undefined, opts.assignedTo ?? null, opts.reason ?? null, opts.needsAttention ?? null],
  );
  await logEvent("info", "conversation.status", `Conversa ${id} → ${status}`, { reason: opts.reason ?? null });
}

export async function markConversationRead(id: string) {
  await db.query(`update conversations set unread_count = 0, needs_attention = false where id = $1`, [id]);
}

export function withinCustomerWindow(lastInboundAt: Date | null): boolean {
  return Boolean(lastInboundAt && Date.now() - new Date(lastInboundAt).getTime() < 24 * 3600_000);
}

/**
 * Envia uma mensagem de texto para o cliente de uma conversa, respeitando o
 * modo teste/produção e a janela de 24 h. Em simulação, apenas registra.
 */
export async function sendToConversation(
  conv: ConversationRow,
  text: string,
  sender: "ai" | "human" | "system",
  opts: { simulate?: boolean } = {},
): Promise<{ ok: boolean; reason?: string }> {
  if (opts.simulate) {
    await insertOutbound(conv.id, sender, text, "simulated", null);
    return { ok: true };
  }
  const info = resolveMode(await getSettings());
  const allowed = canSendTo(info, conv.customer_phone);
  if (!allowed.ok) {
    await insertOutbound(conv.id, sender, text, "blocked", null, { reason: allowed.reason });
    await logEvent("warn", "whatsapp.blocked", allowed.reason, { to: maskPhone(conv.customer_phone) });
    return { ok: false, reason: allowed.reason };
  }
  if (!withinCustomerWindow(conv.last_inbound_at)) {
    const reason = "Fora da janela de 24 h: a Meta exige um modelo (template) aprovado para iniciar a conversa.";
    await insertOutbound(conv.id, sender, text, "blocked", null, { reason });
    return { ok: false, reason };
  }
  const res = await sendText(conv.customer_phone, text);
  if (res.ok) {
    await insertOutbound(conv.id, sender, text, res.dryRun ? "dry_run" : "sent", res.id);
    return { ok: true };
  }
  await insertOutbound(conv.id, sender, text, "failed", null, res.error);
  return { ok: false, reason: res.error.message };
}

/** Alerta a equipe (pedido de atendimento humano etc.). Usa template se configurado. */
export async function notifyAdmin(text: string, conv?: ConversationRow) {
  const settings = await getSettings();
  const info = resolveMode(settings);
  const to = adminAlertRecipient(info);
  await logEvent("warn", "admin.alert", text, { conversation: conv?.id ?? null });
  if (!to) return { ok: false, reason: "Sem número válido para alertas." };
  // Para o próprio número da barbearia (mesmo da API) não faz sentido enviar.
  const template = settings.reminder_templates.admin_alert;
  const res = template
    ? await sendTemplate(to, template, settings.reminder_templates.language, [text.slice(0, 900)])
    : await sendText(to, `🔔 Painel Ojuara\n${text}`);
  return res.ok ? { ok: true } : { ok: false, reason: res.error.message };
}
