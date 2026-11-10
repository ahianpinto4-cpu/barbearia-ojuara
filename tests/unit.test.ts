import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { computeSlots } from "@/lib/booking/engine";
import { brazilPhoneVariants, samePhone, validateRecipient } from "@/lib/phone";
import { addDays, instantToLocal, localToInstant, weekdayOf } from "@/lib/time";
import { canSendTo, isSenderAllowed, resolveMode } from "@/lib/whatsapp/config";
import { parseWebhook, verifySignature } from "@/lib/whatsapp/webhook";
import { DEFAULT_SETTINGS } from "@/lib/server/settings";
import { isHumanRequest } from "@/lib/whatsapp/processor";
import { toApiMessages } from "@/lib/ai/agent";

describe("motor de disponibilidade", () => {
  const base = {
    durationMinutes: 30,
    businessHours: { start: 9 * 60, end: 19 * 60 },
    workIntervals: [
      { start: 9 * 60, end: 12 * 60 },
      { start: 13 * 60, end: 19 * 60 },
    ],
    busy: [],
    earliestStart: 0,
    step: 30,
  };

  it("respeita jornada e pausa de almoço", () => {
    const slots = computeSlots(base);
    expect(slots[0]).toBe(9 * 60);
    expect(slots).toContain(11 * 60 + 30);
    expect(slots).not.toContain(12 * 60);
    expect(slots).not.toContain(12 * 60 + 30);
    expect(slots).toContain(13 * 60);
    expect(slots.at(-1)).toBe(18 * 60 + 30);
  });

  it("serviço longo não ultrapassa o fim do turno", () => {
    const slots = computeSlots({ ...base, durationMinutes: 60 });
    expect(slots).toContain(11 * 60);
    expect(slots).not.toContain(11 * 60 + 30);
    expect(slots.at(-1)).toBe(18 * 60);
  });

  it("remove horários ocupados considerando a duração", () => {
    const slots = computeSlots({ ...base, durationMinutes: 60, busy: [{ start: 10 * 60, end: 10 * 60 + 30 }] });
    expect(slots).not.toContain(9 * 60 + 30); // 9:30–10:30 colidiria
    expect(slots).not.toContain(10 * 60);
    expect(slots).toContain(9 * 60 - 0); // 9:00–10:00 encaixa
    expect(slots).toContain(10 * 60 + 30);
  });

  it("dia fechado não tem horários", () => {
    expect(computeSlots({ ...base, businessHours: null })).toEqual([]);
  });

  it("respeita antecedência mínima", () => {
    const slots = computeSlots({ ...base, earliestStart: 14 * 60 + 10 });
    expect(slots[0]).toBe(14 * 60 + 30);
  });
});

describe("datas em São Cristóvão (UTC-3)", () => {
  it("converte local ↔ instante", () => {
    const i = localToInstant("2026-11-10", "09:00");
    expect(i.toISOString()).toBe("2026-11-10T12:00:00.000Z");
    expect(instantToLocal(i)).toMatchObject({ date: "2026-11-10", time: "09:00" });
  });
  it("calcula dias da semana", () => {
    expect(weekdayOf("2026-11-10")).toBe(2); // terça
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("telefones e modo teste/produção", () => {
  it("recusa o número de teste incompleto (10 dígitos) sem inventar dígito", () => {
    const r = validateRecipient("79 9664 83 60");
    expect(r.ok).toBe(false);
    expect(validateRecipient("557996648360").ok).toBe(false);
    expect(validateRecipient("+55 79 99934-5023")).toEqual({ ok: true, phone: "5579999345023" });
  });

  it("compara wa_id brasileiro com e sem o 9", () => {
    expect(brazilPhoneVariants("5579999345023")).toContain("557999345023");
    expect(samePhone("557999345023", "5579999345023")).toBe(true);
    expect(samePhone("5579999345023", "5579999345024")).toBe(false);
  });

  it("modo teste só conversa com o número autorizado", () => {
    const info = resolveMode({ ...DEFAULT_SETTINGS, whatsapp_mode: "test", test_recipient: "5579911112222" });
    expect(isSenderAllowed(info, "5579911112222")).toBe(true);
    expect(isSenderAllowed(info, "5579933334444")).toBe(false);
    expect(canSendTo(info, "5579933334444").ok).toBe(false);
  });

  it("modo teste sem número válido não envia nada", () => {
    const info = resolveMode({ ...DEFAULT_SETTINGS, whatsapp_mode: "test", test_recipient: "7996648360" });
    expect(isSenderAllowed(info, "7996648360")).toBe(false);
    expect(canSendTo(info, "5579911112222").ok).toBe(false);
  });

  it("modo produção atende qualquer cliente", () => {
    const info = resolveMode({ ...DEFAULT_SETTINGS, whatsapp_mode: "production" });
    expect(isSenderAllowed(info, "5579933334444")).toBe(true);
  });
});

describe("webhook da Meta", () => {
  it("valida a assinatura X-Hub-Signature-256", () => {
    const body = '{"a":1}';
    const sig = "sha256=" + createHmac("sha256", "segredo").update(body).digest("hex");
    expect(verifySignature(body, sig, "segredo")).toBe(true);
    expect(verifySignature(body, sig, "outro")).toBe(false);
    expect(verifySignature(body, null, "segredo")).toBe(false);
    expect(verifySignature(body + " ", sig, "segredo")).toBe(false);
  });

  it("extrai mensagens, nome do perfil e status", () => {
    const payload = {
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: "123" },
                contacts: [{ wa_id: "5579911112222", profile: { name: "Carlos" } }],
                messages: [
                  { id: "wamid.1", from: "5579911112222", timestamp: "1", type: "text", text: { body: "Oi" } },
                  { id: "wamid.2", from: "5579911112222", timestamp: "2", type: "audio", audio: {} },
                ],
                statuses: [{ id: "wamid.out", status: "delivered", recipient_id: "5579911112222" }],
              },
            },
          ],
        },
      ],
    };
    const r = parseWebhook(payload, "123");
    expect(r.messages).toHaveLength(2);
    expect(r.messages[0]).toMatchObject({ text: "Oi", profileName: "Carlos" });
    expect(r.messages[1].text).toContain("áudio");
    expect(r.statuses[0].status).toBe("delivered");
    expect(parseWebhook(payload, "999").messages).toHaveLength(0);
  });
});

describe("detecção de pedido de atendimento humano", () => {
  it.each(["Quero falar com o barbeiro", "quero falar com uma pessoa", "Preciso falar com o responsável", "posso conversar com um atendente?"])(
    "detecta: %s",
    (t) => expect(isHumanRequest(t)).toBe(true),
  );
  it.each(["Quero marcar com o João", "Quero cortar amanhã", "Quanto custa cabelo e barba?"])("não detecta: %s", (t) =>
    expect(isHumanRequest(t)).toBe(false),
  );
});

describe("histórico enviado à IA", () => {
  it("começa sempre por mensagem do cliente", () => {
    const msgs = toApiMessages([
      { role: "assistant", text: "lembrete" },
      { role: "user", text: "oi" },
      { role: "assistant", text: "olá" },
    ]);
    expect(msgs[0].role).toBe("user");
    expect(msgs).toHaveLength(2);
  });
});
