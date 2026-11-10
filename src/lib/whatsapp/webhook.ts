import { createHmac, timingSafeEqual } from "node:crypto";

/** Verifica a assinatura X-Hub-Signature-256 enviada pela Meta. */
export function verifySignature(rawBody: string, signatureHeader: string | null, appSecret: string): boolean {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const received = signatureHeader.slice("sha256=".length);
  if (received.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(received, "hex"), Buffer.from(expected, "hex"));
}

export type InboundMessage = {
  id: string;
  from: string;
  timestamp: number;
  type: string;
  text: string;
  profileName: string | null;
};

export type StatusUpdate = {
  id: string;
  status: "sent" | "delivered" | "read" | "failed" | string;
  recipient: string;
  errors?: { code: number; title?: string; message?: string }[];
};

type WebhookPayload = {
  object?: string;
  entry?: {
    changes?: {
      field?: string;
      value?: {
        metadata?: { phone_number_id?: string };
        contacts?: { wa_id: string; profile?: { name?: string } }[];
        messages?: Record<string, unknown>[];
        statuses?: Record<string, unknown>[];
      };
    }[];
  }[];
};

const MEDIA_LABEL: Record<string, string> = {
  image: "[O cliente enviou uma imagem]",
  audio: "[O cliente enviou um áudio]",
  video: "[O cliente enviou um vídeo]",
  document: "[O cliente enviou um documento]",
  sticker: "[O cliente enviou uma figurinha]",
  location: "[O cliente enviou uma localização]",
  contacts: "[O cliente enviou um contato]",
};

function extractText(m: Record<string, unknown>): string {
  const type = String(m.type);
  if (type === "text") return String((m.text as { body?: string })?.body ?? "");
  if (type === "button") return String((m.button as { text?: string })?.text ?? "");
  if (type === "interactive") {
    const i = m.interactive as { button_reply?: { title?: string }; list_reply?: { title?: string } };
    return String(i?.button_reply?.title ?? i?.list_reply?.title ?? "");
  }
  if (type === "image" || type === "video" || type === "document") {
    const caption = (m[type] as { caption?: string })?.caption;
    return caption ? `${MEDIA_LABEL[type]} Legenda: ${caption}` : MEDIA_LABEL[type];
  }
  return MEDIA_LABEL[type] ?? `[Mensagem do tipo ${type} não suportada]`;
}

/** Extrai mensagens e atualizações de status do payload do webhook. */
export function parseWebhook(payload: unknown, expectedPhoneNumberId?: string) {
  const p = payload as WebhookPayload;
  const messages: InboundMessage[] = [];
  const statuses: StatusUpdate[] = [];
  if (p?.object !== "whatsapp_business_account") return { messages, statuses };
  for (const entry of p.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages" || !change.value) continue;
      const v = change.value;
      if (expectedPhoneNumberId && v.metadata?.phone_number_id && v.metadata.phone_number_id !== expectedPhoneNumberId) continue;
      const names = new Map((v.contacts ?? []).map((c) => [c.wa_id, c.profile?.name ?? null]));
      for (const m of v.messages ?? []) {
        if (!m.id || !m.from) continue;
        messages.push({
          id: String(m.id),
          from: String(m.from),
          timestamp: Number(m.timestamp ?? 0),
          type: String(m.type),
          text: extractText(m).slice(0, 4000),
          profileName: names.get(String(m.from)) ?? null,
        });
      }
      for (const s of v.statuses ?? []) {
        if (!s.id) continue;
        statuses.push({
          id: String(s.id),
          status: String(s.status),
          recipient: String(s.recipient_id ?? ""),
          errors: s.errors as StatusUpdate["errors"],
        });
      }
    }
  }
  return { messages, statuses };
}
