import { samePhone, validateRecipient } from "@/lib/phone";
import type { Settings } from "@/lib/server/settings";

/**
 * Regras de TESTE x PRODUÇÃO.
 *
 * - Número de ORIGEM: o número conectado à Cloud API (META_PHONE_NUMBER_ID).
 * - Número de DESTINO:
 *     TESTE      → somente o número autorizado do responsável (test_recipient).
 *     PRODUÇÃO   → qualquer cliente que iniciar conversa.
 * - Alertas ao administrador vão para o número de teste (TESTE) ou para o
 *   número oficial da barbearia (PRODUÇÃO).
 */
export type ModeInfo = {
  mode: "test" | "production";
  testRecipient: { ok: true; phone: string } | { ok: false; reason: string };
  productionRecipient: { ok: true; phone: string } | { ok: false; reason: string };
};

export function resolveMode(settings: Settings): ModeInfo {
  return {
    mode: settings.whatsapp_mode === "production" ? "production" : "test",
    testRecipient: validateRecipient(settings.test_recipient),
    productionRecipient: validateRecipient(settings.production_recipient),
  };
}

/** Em modo teste, só o número autorizado pode conversar com o assistente. */
export function isSenderAllowed(info: ModeInfo, from: string): boolean {
  if (info.mode === "production") return true;
  return info.testRecipient.ok && samePhone(info.testRecipient.phone, from);
}

/** Pode enviar mensagem para este destino no modo atual? */
export function canSendTo(info: ModeInfo, to: string): { ok: true } | { ok: false; reason: string } {
  if (info.mode === "production") return { ok: true };
  if (!info.testRecipient.ok) return { ok: false, reason: `Modo teste sem número autorizado válido: ${info.testRecipient.reason}` };
  if (!samePhone(info.testRecipient.phone, to)) return { ok: false, reason: "Modo teste: destino diferente do número autorizado." };
  return { ok: true };
}

/** Destino dos alertas para a equipe (pedido de atendimento humano, falhas). */
export function adminAlertRecipient(info: ModeInfo): string | null {
  const r = info.mode === "production" ? info.productionRecipient : info.testRecipient;
  return r.ok ? r.phone : null;
}
