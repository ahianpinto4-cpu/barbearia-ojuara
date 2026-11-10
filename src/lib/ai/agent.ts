import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/server/env";
import { logEvent } from "@/lib/server/log";
import { confirmationMessage, executeTool, TOOL_DEFINITIONS, type ToolContext } from "./tools";
import { SYSTEM_PROMPT } from "./prompt";

/**
 * Loop de atendimento com a Claude API (Messages API + ferramentas do backend).
 *
 * - O prompt de sistema e as ferramentas são fixos (cache de prompt eficiente).
 * - O contexto variável (data/hora, cliente) entra como mensagem de sistema no
 *   fim da conversa.
 * - O histórico entre turnos é reenviado só com texto (sem blocos de raciocínio),
 *   o que mantém o histórico "somente-acréscimo" válido.
 * - Fallback de recusa no servidor habilitado (fallbacks: "default").
 */
export type ChatTurn = { role: "user" | "assistant"; text: string };

export type AgentResult =
  | { ok: true; reply: string; usedTools: string[] }
  | { ok: false; reason: "not_configured" | "refusal" | "api_error" | "max_iterations"; detail?: string };

const MAX_ITERATIONS = 8;

let client: Anthropic | null = null;
function getClient() {
  if (!env.claudeApiKey) return null;
  client ??= new Anthropic({ apiKey: env.claudeApiKey, maxRetries: 2, timeout: 60_000 });
  return client;
}

/** Converte o histórico em mensagens válidas (começa com usuário; papéis consecutivos são permitidos). */
export function toApiMessages(history: ChatTurn[]): Anthropic.Beta.BetaMessageParam[] {
  const firstUser = history.findIndex((t) => t.role === "user");
  if (firstUser === -1) return [];
  return history
    .slice(firstUser)
    .filter((t) => t.text.trim() !== "")
    .map((t) => ({ role: t.role, content: t.text }));
}

export async function runAssistant(opts: {
  history: ChatTurn[];
  contextMessage: string;
  ctx: ToolContext;
  /** Permite injetar um cliente falso nos testes automatizados. */
  clientOverride?: Pick<Anthropic, "beta">;
}): Promise<AgentResult> {
  const anthropic = opts.clientOverride ?? getClient();
  if (!anthropic) return { ok: false, reason: "not_configured" };

  const messages: Anthropic.Beta.BetaMessageParam[] = toApiMessages(opts.history);
  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return { ok: false, reason: "api_error", detail: "Nenhuma mensagem nova do cliente." };
  }
  messages.push({ role: "system", content: opts.contextMessage });

  const usedTools: string[] = [];
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    let response: Anthropic.Beta.BetaMessage;
    try {
      response = await anthropic.beta.messages.create({
        model: env.claudeModel,
        max_tokens: 4096,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        thinking: { type: "adaptive" },
        output_config: { effort: "medium" },
        system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        tools: TOOL_DEFINITIONS,
        messages,
      });
    } catch (err) {
      const detail =
        err instanceof Anthropic.AuthenticationError
          ? "Chave da Claude API inválida."
          : err instanceof Anthropic.RateLimitError
            ? "Limite de uso da Claude API atingido."
            : err instanceof Anthropic.APIError
              ? `Claude API ${err.status}: ${err.message}`
              : String(err);
      await logEvent("error", "ai.api_error", detail);
      return { ok: false, reason: "api_error", detail };
    }

    if (response.stop_reason === "refusal") {
      await logEvent("warn", "ai.refusal", "O modelo recusou a solicitação", {
        category: response.stop_details?.category ?? null,
      });
      return { ok: false, reason: "refusal" };
    }

    if (response.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content });
      continue;
    }

    const toolUses = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");

    if (response.stop_reason !== "tool_use" || toolUses.length === 0) {
      let reply = response.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      // Rede de segurança: agendamento gravado → a confirmação oficial sempre é enviada.
      const last = opts.ctx.bookings.at(-1);
      if (last && !reply.includes("confirmado com sucesso")) {
        reply = `${confirmationMessage(last)}${reply ? `\n\n${reply}` : ""}`;
      }
      if (!reply) return { ok: false, reason: "api_error", detail: "Resposta vazia do modelo." };
      return { ok: true, reply, usedTools };
    }

    messages.push({ role: "assistant", content: response.content });
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      usedTools.push(tu.name);
      try {
        const { result, isError } = await executeTool(tu.name, tu.input, opts.ctx);
        results.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(result), is_error: isError });
      } catch (err) {
        await logEvent("error", "ai.tool_error", `${tu.name}: ${String(err)}`);
        results.push({
          type: "tool_result",
          tool_use_id: tu.id,
          is_error: true,
          content: JSON.stringify({ erro: "ERRO_INTERNO", instrucao: "Peça desculpas e ofereça atendimento humano." }),
        });
      }
    }
    messages.push({ role: "user", content: results });
  }
  await logEvent("warn", "ai.max_iterations", "Limite de iterações atingido");
  return { ok: false, reason: "max_iterations" };
}
