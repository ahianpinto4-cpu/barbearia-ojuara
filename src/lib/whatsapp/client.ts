import { env } from "@/lib/server/env";
import { logEvent, maskPhone } from "@/lib/server/log";

/**
 * Cliente da WhatsApp Business Platform (Cloud API oficial da Meta).
 * Toda chamada passa por aqui — o token nunca sai do servidor.
 */
export type SendResult =
  | { ok: true; id: string | null; dryRun?: boolean }
  | { ok: false; error: { code: number | string; message: string; outsideWindow?: boolean; recipientNotAllowed?: boolean } };

type GraphError = { error?: { message?: string; code?: number; error_subcode?: number; error_data?: { details?: string } } };

async function post(body: Record<string, unknown>): Promise<SendResult> {
  const to = String(body.to ?? "");
  if (env.whatsappDryRun) {
    if (body.status === "read") return { ok: true, id: null, dryRun: true };
    await logEvent("info", "whatsapp.dry_run", `Envio simulado para ${maskPhone(to)}`, { type: body.type });
    return { ok: true, id: null, dryRun: true };
  }
  if (!env.metaToken || !env.metaPhoneNumberId) {
    return { ok: false, error: { code: "NOT_CONFIGURED", message: "META_WHATSAPP_TOKEN/META_PHONE_NUMBER_ID não configurados." } };
  }
  const url = `https://graph.facebook.com/${env.metaGraphVersion}/${env.metaPhoneNumberId}/messages`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.metaToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(
        body.status === "read"
          ? { messaging_product: "whatsapp", status: "read", message_id: body.message_id }
          : { messaging_product: "whatsapp", recipient_type: "individual", ...body },
      ),
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json().catch(() => ({}))) as GraphError & { messages?: { id: string }[] };
    if (!res.ok || json.error) {
      const code = json.error?.code ?? res.status;
      const message = json.error?.error_data?.details ?? json.error?.message ?? `HTTP ${res.status}`;
      const error = {
        code,
        message,
        // 131047: fora da janela de 24 h (exige template aprovado)
        outsideWindow: code === 131047,
        // 131030: destinatário não está na lista de números de teste da Meta
        recipientNotAllowed: code === 131030,
      };
      await logEvent("error", "whatsapp.send_failed", message, { code, to: maskPhone(to), type: body.type });
      return { ok: false, error };
    }
    return { ok: true, id: json.messages?.[0]?.id ?? null };
  } catch (err) {
    await logEvent("error", "whatsapp.network_error", String(err), { to: maskPhone(to) });
    return { ok: false, error: { code: "NETWORK", message: String(err) } };
  }
}

export function sendText(to: string, text: string) {
  return post({ to, type: "text", text: { preview_url: false, body: text.slice(0, 4096) } });
}

/** Envia um modelo (template) aprovado pela Meta — necessário fora da janela de 24 h. */
export function sendTemplate(to: string, name: string, language: string, bodyParams: string[]) {
  return post({
    to,
    type: "template",
    template: {
      name,
      language: { code: language },
      components: bodyParams.length
        ? [{ type: "body", parameters: bodyParams.map((text) => ({ type: "text", text })) }]
        : [],
    },
  });
}

/** Marca a mensagem recebida como lida (os dois tiques azuis). */
export function markAsRead(messageId: string) {
  return post({ status: "read", message_id: messageId });
}
