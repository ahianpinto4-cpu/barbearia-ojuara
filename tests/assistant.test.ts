import type Anthropic from "@anthropic-ai/sdk";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { runAssistant } from "@/lib/ai/agent";
import { executeTool, type ToolContext } from "@/lib/ai/tools";
import { db, getPool } from "@/lib/server/db";
import { processDueNotifications } from "@/lib/server/notifications";
import { handleInboundMessage } from "@/lib/whatsapp/processor";
import { makeCustomer, nextWeekday, resetScenario } from "./helpers";

let s: Awaited<ReturnType<typeof resetScenario>>;
const MONDAY = nextWeekday(1);

beforeEach(async () => {
  s = await resetScenario();
});
afterAll(async () => {
  await getPool().end();
});

function ctxFor(customerId: string): ToolContext {
  return { customerId, customerName: null, isTest: true, bookings: [], onHandoff: vi.fn(async () => {}) };
}

/** Cliente falso da Claude API que devolve respostas roteirizadas, em ordem. */
function scriptedClient(steps: Partial<Anthropic.Beta.BetaMessage>[]) {
  const calls: Anthropic.Beta.MessageCreateParams[] = [];
  const create = vi.fn(async (params: Anthropic.Beta.MessageCreateParams) => {
    calls.push(structuredClone(params));
    const step = steps.shift();
    if (!step) throw new Error("roteiro acabou");
    return { stop_reason: "end_turn", stop_details: null, content: [], ...step } as Anthropic.Beta.BetaMessage;
  });
  return { client: { beta: { messages: { create } } } as unknown as Pick<Anthropic, "beta">, calls };
}

describe("ferramentas do assistente (validadas no backend)", () => {
  it("consulta serviços sem inventar dados", async () => {
    const c = await makeCustomer();
    const r = await executeTool("consultar_servicos", {}, ctxFor(c));
    const list = r.result as { nome: string; preco: string }[];
    expect(list.map((x) => x.nome)).toContain("Corte TESTE");
    expect(list.find((x) => x.nome === "Sem duração TESTE")?.preco).toBe("valor sob consulta");
  });

  it("recusa parâmetros inválidos", async () => {
    const c = await makeCustomer();
    const r = await executeTool("consultar_disponibilidade", { servico_id: "x", data: "amanhã" }, ctxFor(c));
    expect(r.isError).toBe(true);
  });

  it("não agenda sem confirmação explícita do cliente", async () => {
    const c = await makeCustomer();
    const r = await executeTool(
      "criar_agendamento",
      { servico_id: s.service30, data: MONDAY, horario: "09:00", nome_cliente: "Carlos", cliente_confirmou: false },
      ctxFor(c),
    );
    expect(r.result).toMatchObject({ erro: "CONFIRMACAO_PENDENTE" });
    const { rows } = await db.query(`select count(*)::int as n from appointments`);
    expect(rows[0].n).toBe(0);
  });

  it("filtra horários 'depois das 16h'", async () => {
    const c = await makeCustomer();
    const r = await executeTool("consultar_disponibilidade", { servico_id: s.service30, data: MONDAY, a_partir_de: "16:00" }, ctxFor(c));
    const res = r.result as { barbeiros: { nome: string; horarios_livres: string[] }[] };
    expect(res.barbeiros[0].horarios_livres.every((h) => h >= "16:00")).toBe(true);
  });
});

describe("loop do assistente com ferramentas", () => {
  it("consulta, agenda após confirmação e devolve a mensagem oficial", async () => {
    const c = await makeCustomer();
    const ctx = ctxFor(c);
    const { client, calls } = scriptedClient([
      {
        stop_reason: "tool_use",
        content: [
          { type: "tool_use", id: "t1", name: "consultar_disponibilidade", input: { servico_id: s.service30, data: MONDAY, barbeiro_id: s.barberA }, caller: { type: "direct" } } as never,
        ],
      },
      {
        stop_reason: "tool_use",
        content: [
          {
            type: "tool_use",
            id: "t2",
            name: "criar_agendamento",
            input: { servico_id: s.service30, data: MONDAY, horario: "09:00", barbeiro_id: s.barberA, nome_cliente: "Carlos", cliente_confirmou: true },
            caller: { type: "direct" },
          } as never,
        ],
      },
      { stop_reason: "end_turn", content: [{ type: "text", text: "Prontinho!", citations: null } as never] },
    ]);

    const result = await runAssistant({
      history: [
        { role: "user", text: "Quero cortar segunda às 9h com o Barbeiro A" },
        { role: "assistant", text: "Resumo: ... Confirma?" },
        { role: "user", text: "Sim, confirmo" },
      ],
      contextMessage: "Contexto de teste",
      ctx,
      clientOverride: client,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.reply).toContain("Seu horário foi confirmado com sucesso! 💈");
      expect(result.reply).toContain("💰 Valor: R$");
      expect(result.usedTools).toEqual(["consultar_disponibilidade", "criar_agendamento"]);
    }
    // Contexto variável vai como mensagem de sistema no fim; prompt e ferramentas fixos.
    expect(calls[0].messages.at(-1)).toMatchObject({ role: "system" });
    expect(calls[0].tools?.length).toBe(10);
    expect(JSON.stringify(calls[1].messages)).toContain("tool_result");
    const { rows } = await db.query(`select customer_name, status, is_test from appointments`);
    expect(rows).toEqual([{ customer_name: "Carlos", status: "confirmed", is_test: true }]);
  });

  it("recusa do modelo vira falha controlada (transferência)", async () => {
    const c = await makeCustomer();
    const { client } = scriptedClient([{ stop_reason: "refusal", content: [] }]);
    const result = await runAssistant({ history: [{ role: "user", text: "oi" }], contextMessage: "x", ctx: ctxFor(c), clientOverride: client });
    expect(result).toMatchObject({ ok: false, reason: "refusal" });
  });

  it("sem CLAUDE_API_KEY informa que não está configurado", async () => {
    const c = await makeCustomer();
    const result = await runAssistant({ history: [{ role: "user", text: "oi" }], contextMessage: "x", ctx: ctxFor(c) });
    expect(result).toMatchObject({ ok: false, reason: "not_configured" });
  });
});

describe("processamento de mensagens do WhatsApp", () => {
  const msg = (id: string, text: string, from = "5579911112222") => ({ id, from, timestamp: 0, type: "text", text, profileName: "Carlos" });

  it("modo teste ignora remetentes não autorizados e não grava dados", async () => {
    await db.query(`update settings set value = '"5579911112222"' where key = 'test_recipient'`);
    const r = await handleInboundMessage(msg("wamid.x1", "Oi", "5579955556666"));
    expect(r.status).toBe("ignored");
    const { rows } = await db.query(`select count(*)::int as n from customers`);
    expect(rows[0].n).toBe(0);
  });

  it("mensagem duplicada (mesmo id do WhatsApp) é processada uma vez só", async () => {
    await db.query(`update settings set value = '"5579911112222"' where key = 'test_recipient'`);
    await db.query(`update settings set value = 'false' where key = 'ai_enabled'`);
    expect((await handleInboundMessage(msg("wamid.dup", "Oi"))).status).toBe("ai_disabled");
    expect((await handleInboundMessage(msg("wamid.dup", "Oi"))).status).toBe("duplicate");
    const { rows } = await db.query(`select count(*)::int as n from messages`);
    expect(rows[0].n).toBe(1);
  });

  it("pedido de humano: muda estado, avisa cliente e pausa a IA", async () => {
    await db.query(`update settings set value = '"5579911112222"' where key = 'test_recipient'`);
    expect((await handleInboundMessage(msg("wamid.h1", "Quero falar com uma pessoa"))).status).toBe("handoff");
    const { rows: conv } = await db.query(`select status, needs_attention from conversations`);
    expect(conv[0]).toEqual({ status: "HUMAN_REQUESTED", needs_attention: true });
    const { rows: out } = await db.query(`select sender, content, status from messages where direction = 'outbound'`);
    expect(out[0].sender).toBe("system");
    expect(out[0].content).toContain("atendente");
    expect(out[0].status).toBe("dry_run");
    // Enquanto humano, a IA não responde
    expect((await handleInboundMessage(msg("wamid.h2", "Alô?"))).status).toBe("human_mode");
    const { rows: n } = await db.query(`select count(*)::int as n from messages where direction = 'outbound'`);
    expect(n[0].n).toBe(1);
  });

  it("IA sem chave configurada: cliente recebe aviso e conversa vai para a equipe", async () => {
    const r = await handleInboundMessage(msg("sim.1", "Oi, quero cortar amanhã"), { simulate: true });
    expect(r.status).toBe("processed");
    const { rows } = await db.query(`select status from conversations`);
    expect(rows[0].status).toBe("HUMAN_REQUESTED");
    const { rows: out } = await db.query(`select status from messages where direction = 'outbound'`);
    expect(out[0].status).toBe("simulated");
  });
});

describe("lembretes", () => {
  it("sem template e fora da janela de 24 h, o lembrete é registrado como pulado (não é enviado)", async () => {
    await db.query(`update settings set value = '"5579911112222"' where key = 'test_recipient'`);
    const c = await makeCustomer("5579911112222", "Carlos");
    const { rows } = await db.query<{ id: string }>(
      `insert into appointments (customer_id, barber_id, service_id, appointment_date, start_time, end_time, start_at, end_at, source, is_test)
       values ($1, $2, $3, $4, '09:00', '09:30', now() + interval '3 hours', now() + interval '210 minutes', 'whatsapp', true) returning id`,
      [c, s.barberA, s.service30, MONDAY],
    );
    await db.query(`insert into notification_jobs (appointment_id, kind, scheduled_for) values ($1, 'reminder_2h', now() - interval '1 minute')`, [rows[0].id]);
    const summary = await processDueNotifications();
    expect(summary.skipped).toBe(1);
    const again = await processDueNotifications();
    expect(again).toMatchObject({ sent: 0, skipped: 0 }); // nunca reprocessa
  });

  it("dentro da janela de 24 h envia (dry run) uma única vez", async () => {
    await db.query(`update settings set value = '"5579911112222"' where key = 'test_recipient'`);
    const c = await makeCustomer("5579911112222", "Carlos");
    await db.query(`insert into conversations (customer_id, last_inbound_at, is_test) values ($1, now(), true)`, [c]);
    const { rows } = await db.query<{ id: string }>(
      `insert into appointments (customer_id, barber_id, service_id, appointment_date, start_time, end_time, start_at, end_at, source, is_test)
       values ($1, $2, $3, $4, '09:00', '09:30', now() + interval '3 hours', now() + interval '210 minutes', 'whatsapp', true) returning id`,
      [c, s.barberA, s.service30, MONDAY],
    );
    await db.query(`insert into notification_jobs (appointment_id, kind, scheduled_for) values ($1, 'reminder_2h', now() - interval '1 minute')`, [rows[0].id]);
    expect((await processDueNotifications()).sent).toBe(1);
    expect((await processDueNotifications()).sent).toBe(0);
  });
});
