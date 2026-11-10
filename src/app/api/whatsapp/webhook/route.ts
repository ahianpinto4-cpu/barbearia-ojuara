import { after, type NextRequest } from "next/server";
import { env } from "@/lib/server/env";
import { logEvent } from "@/lib/server/log";
import { handleInboundMessage, handleStatusUpdate } from "@/lib/whatsapp/processor";
import { parseWebhook, verifySignature } from "@/lib/whatsapp/webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Verificação do webhook (configurada no painel da Meta). */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const mode = p.get("hub.mode");
  const token = p.get("hub.verify_token");
  const challenge = p.get("hub.challenge");
  if (mode === "subscribe" && env.metaVerifyToken && token === env.metaVerifyToken && challenge) {
    await logEvent("info", "whatsapp.webhook_verified", "Webhook verificado pela Meta");
    return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  await logEvent("warn", "whatsapp.webhook_verify_failed", "Falha na verificação do webhook");
  return new Response("Forbidden", { status: 403 });
}

/** Recebimento de mensagens e status. Responde 200 rápido e processa logo em seguida. */
export async function POST(req: NextRequest) {
  if (!env.metaAppSecret) {
    await logEvent("error", "whatsapp.not_configured", "META_APP_SECRET ausente: webhook recusado.");
    return new Response("Not configured", { status: 503 });
  }
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"), env.metaAppSecret)) {
    await logEvent("warn", "whatsapp.invalid_signature", "Assinatura inválida no webhook");
    return new Response("Invalid signature", { status: 401 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  const { messages, statuses } = parseWebhook(payload, env.metaPhoneNumberId);

  after(async () => {
    for (const s of statuses) {
      await handleStatusUpdate(s).catch((err) => logEvent("error", "whatsapp.status_error", String(err)));
    }
    for (const m of messages) {
      await handleInboundMessage(m).catch((err) => logEvent("error", "whatsapp.process_error", String(err), { id: m.id }));
    }
  });
  return Response.json({ received: true });
}
