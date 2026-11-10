import { buildContextMessage } from "@/lib/ai/prompt";
import { runAssistant, type ChatTurn } from "@/lib/ai/agent";
import type { ToolContext } from "@/lib/ai/tools";
import { upsertCustomer } from "@/lib/server/booking";
import {
  AI_SILENT_STATUSES,
  getConversation,
  getOrCreateConversation,
  insertInbound,
  notifyAdmin,
  sendToConversation,
  setConversationStatus,
  type ConversationRow,
} from "@/lib/server/conversations";
import { db } from "@/lib/server/db";
import { logEvent, maskPhone } from "@/lib/server/log";
import { getSettings } from "@/lib/server/settings";
import { formatPhonePretty } from "@/lib/phone";
import { markAsRead } from "./client";
import { isSenderAllowed, resolveMode } from "./config";
import type { InboundMessage, StatusUpdate } from "./webhook";

/** Pedido explícito de atendimento humano (funciona mesmo sem a IA configurada). */
const HUMAN_REQUEST =
  /\b(falar|conversar|atendimento|chamar|quero|preciso)\b.{0,30}\b(humano|pessoa|atendente|barbeiro|respons[aá]vel|dono|gerente|algu[eé]m de verdade)\b/i;

export function isHumanRequest(text: string): boolean {
  return HUMAN_REQUEST.test(text) && !/\b(marcar|agendar|cortar|hor[aá]rio)\b/i.test(text);
}

type ProcessOptions = { simulate?: boolean };

/** Processa uma mensagem recebida (webhook ou simulador do painel). */
export async function handleInboundMessage(msg: InboundMessage, opts: ProcessOptions = {}) {
  const settings = await getSettings();
  const mode = resolveMode(settings);

  if (!opts.simulate && !isSenderAllowed(mode, msg.from)) {
    // Modo teste: mensagens de outros números não são armazenadas nem respondidas.
    await logEvent("info", "whatsapp.ignored_sender", "Mensagem ignorada (modo teste, remetente não autorizado)", {
      from: maskPhone(msg.from),
    });
    return { status: "ignored" as const };
  }

  const isTest = opts.simulate || mode.mode === "test";
  const customer = await upsertCustomer(msg.from, isTest);
  const conv = await getOrCreateConversation(customer.id, isTest);
  const isFirstContact = !(await hasPreviousMessages(conv.id));
  const inserted = await insertInbound(conv.id, msg.text, opts.simulate ? null : msg.id, msg.type);
  if (!inserted) {
    await logEvent("debug", "whatsapp.duplicate", "Mensagem duplicada ignorada", { id: msg.id });
    return { status: "duplicate" as const };
  }
  if (!opts.simulate) void markAsRead(msg.id);

  const fresh = (await getConversation(conv.id))!;

  if (AI_SILENT_STATUSES.includes(fresh.status)) {
    await db.query(`update conversations set needs_attention = true where id = $1`, [conv.id]);
    return { status: "human_mode" as const };
  }

  if (isHumanRequest(msg.text)) {
    await handoff(fresh, "Cliente pediu para falar com uma pessoa.", settings.handoff_message, opts);
    return { status: "handoff" as const };
  }

  if (!settings.ai_enabled) {
    await db.query(`update conversations set needs_attention = true where id = $1`, [conv.id]);
    return { status: "ai_disabled" as const };
  }

  await runForConversation(conv.id, {
    ...opts,
    profileName: msg.profileName,
    isFirstContact,
    mode: opts.simulate ? "simulation" : mode.mode,
  });
  return { status: "processed" as const };
}

async function hasPreviousMessages(conversationId: string) {
  const { rows } = await db.query(`select 1 from messages where conversation_id = $1 limit 1`, [conversationId]);
  return rows.length > 0;
}

/** Transfere para atendimento humano: muda estado, avisa cliente e equipe. */
export async function handoff(conv: ConversationRow, reason: string, message: string, opts: ProcessOptions = {}) {
  await setConversationStatus(conv.id, "HUMAN_REQUESTED", { reason, needsAttention: true });
  await sendToConversation(conv, message, "system", opts);
  if (!opts.simulate) {
    const who = conv.customer_name ?? formatPhonePretty(conv.customer_phone);
    await notifyAdmin(`Atendimento humano solicitado por ${who}. Motivo: ${reason}. Abra o painel em Conversas.`, conv);
  }
}

/**
 * Executa o assistente para a conversa com uma "trava" (lease) para não gerar
 * respostas duplicadas quando chegam várias mensagens seguidas. Se novas
 * mensagens chegarem durante o processamento, roda de novo (até 3 vezes).
 */
async function runForConversation(
  conversationId: string,
  opts: ProcessOptions & { profileName: string | null; isFirstContact: boolean; mode: "test" | "production" | "simulation" },
) {
  const lease = await db.query(
    `update conversations set processing_until = now() + interval '90 seconds'
     where id = $1 and (processing_until is null or processing_until < now()) returning id`,
    [conversationId],
  );
  if (!lease.rows[0]) return; // outra execução já está cuidando desta conversa

  try {
    for (let round = 0; round < 3; round++) {
      const conv = (await getConversation(conversationId))!;
      if (AI_SILENT_STATUSES.includes(conv.status)) return;
      const { rows: hist } = await db.query<{ direction: string; sender: string; content: string; created_at: Date }>(
        `select * from (select direction, sender, content, created_at from messages where conversation_id = $1
           order by created_at desc limit 40) t order by created_at`,
        [conversationId],
      );
      const last = hist.at(-1);
      if (!last || last.direction !== "inbound") return; // nada novo para responder
      const snapshot = last.created_at;

      const history: ChatTurn[] = hist.map((m) => ({
        role: m.direction === "inbound" ? "user" : "assistant",
        text: m.sender === "human" ? `(Mensagem enviada por um atendente da barbearia) ${m.content}` : m.content,
      }));

      const settings = await getSettings();
      const ctx: ToolContext = {
        customerId: conv.customer_id,
        customerName: conv.customer_name,
        isTest: conv.is_test,
        bookings: [],
        onHandoff: async (reason) => {
          await setConversationStatus(conv.id, "HUMAN_REQUESTED", { reason, needsAttention: true });
          if (!opts.simulate) {
            const who = conv.customer_name ?? formatPhonePretty(conv.customer_phone);
            await notifyAdmin(`Atendimento humano solicitado por ${who}. Motivo: ${reason}.`, conv);
          }
        },
      };

      const result = await runAssistant({
        history,
        ctx,
        contextMessage: buildContextMessage({
          now: new Date(),
          customerName: conv.customer_name,
          profileName: opts.profileName,
          customerPhone: conv.customer_phone,
          isFirstContact: opts.isFirstContact && round === 0,
          mode: opts.mode,
          extraInstructions: settings.assistant_extra_instructions,
          greeting: settings.greeting_message,
        }),
      });

      if (result.ok) {
        await sendToConversation(conv, result.reply, "ai", opts);
      } else {
        // Falha da IA: nunca deixar o cliente sem resposta — transfere para a equipe.
        const msg =
          result.reason === "not_configured"
            ? "Olá! Recebemos sua mensagem na Barbearia Ojuara 💈 Um atendente vai te responder por aqui em breve."
            : "Desculpe, tive uma instabilidade aqui. Já chamei a equipe da Barbearia Ojuara para continuar seu atendimento por aqui. 💈";
        await handoff(conv, `Assistente indisponível (${result.reason}${result.detail ? `: ${result.detail}` : ""})`, msg, opts);
        return;
      }

      // Chegou mensagem nova enquanto processava? Responde de novo com o contexto completo.
      const newer = await db.query(
        `select 1 from messages where conversation_id = $1 and direction = 'inbound' and created_at > $2 limit 1`,
        [conversationId, snapshot],
      );
      if (!newer.rows[0]) return;
    }
  } finally {
    await db.query(`update conversations set processing_until = null where id = $1`, [conversationId]);
  }
}

/** Atualiza o status de entrega das mensagens enviadas (sent/delivered/read/failed). */
export async function handleStatusUpdate(s: StatusUpdate) {
  const { rowCount } = await db.query(
    `update messages set status = $2, error = coalesce($3::jsonb, error) where whatsapp_message_id = $1`,
    [s.id, s.status, s.errors ? JSON.stringify(s.errors) : null],
  );
  await db.query(
    `update notification_jobs set status = 'failed', last_error = $2 where whatsapp_message_id = $1 and $3`,
    [s.id, s.errors?.[0]?.message ?? s.errors?.[0]?.title ?? null, s.status === "failed"],
  );
  if (s.status === "failed") {
    await logEvent("error", "whatsapp.delivery_failed", s.errors?.[0]?.title ?? "Falha de entrega", {
      code: s.errors?.[0]?.code ?? null,
      to: maskPhone(s.recipient),
    });
  }
  return rowCount;
}
