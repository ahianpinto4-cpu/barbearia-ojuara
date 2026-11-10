/**
 * Telefones no formato internacional, somente dígitos (ex.: 5579999345023).
 */
export function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

/** Celular brasileiro completo: 55 + DDD (2) + 9 + 8 dígitos = 13 dígitos. */
export function isValidBrazilMobile(phone: string): boolean {
  return /^55[1-9]\d9\d{8}$/.test(phone);
}

export function validateRecipient(raw: string | undefined | null): { ok: true; phone: string } | { ok: false; reason: string } {
  if (!raw) return { ok: false, reason: "Número não informado." };
  const phone = digitsOnly(raw);
  if (phone.length === 10 || phone.length === 11) {
    return { ok: false, reason: "Inclua o código do país (55). Ex.: 5579912345678." };
  }
  if (phone.startsWith("55") && phone.length === 12) {
    return {
      ok: false,
      reason: "Número com 12 dígitos: parece faltar um dígito do celular (o 9 após o DDD). Informe o número completo.",
    };
  }
  if (!isValidBrazilMobile(phone)) return { ok: false, reason: "Número inválido. Use 55 + DDD + 9 dígitos." };
  return { ok: true, phone };
}

/**
 * O WhatsApp pode identificar celulares brasileiros antigos sem o 9 extra
 * (wa_id com 12 dígitos). Gera as duas formas para comparação.
 */
export function brazilPhoneVariants(phone: string): string[] {
  const d = digitsOnly(phone);
  const out = new Set([d]);
  if (/^55\d{2}9\d{8}$/.test(d)) out.add(d.slice(0, 4) + d.slice(5));
  if (/^55\d{2}\d{8}$/.test(d)) out.add(d.slice(0, 4) + "9" + d.slice(4));
  return [...out];
}

export function samePhone(a: string, b: string): boolean {
  const va = brazilPhoneVariants(a);
  return brazilPhoneVariants(b).some((x) => va.includes(x));
}

/** +55 (79) 99934-5023 */
export function formatPhonePretty(phone: string): string {
  const d = digitsOnly(phone);
  const m = d.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `+55 (${m[1]}) ${m[2]}-${m[3]}` : `+${d}`;
}
