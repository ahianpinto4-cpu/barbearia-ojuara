/**
 * Leitura centralizada das variáveis de ambiente (somente no servidor).
 * Nenhum segredo é exposto ao navegador: nada aqui usa o prefixo NEXT_PUBLIC_.
 */
function read(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

export const env = {
  appEnv: (read("APP_ENV") ?? "development") as "development" | "test" | "production",
  databaseUrl: read("DATABASE_URL"),
  sessionSecret: read("SESSION_SECRET"),
  cronSecret: read("CRON_SECRET"),

  // Meta / WhatsApp Cloud API
  metaToken: read("META_WHATSAPP_TOKEN"),
  metaPhoneNumberId: read("META_PHONE_NUMBER_ID"),
  metaVerifyToken: read("META_VERIFY_TOKEN"),
  metaAppSecret: read("META_APP_SECRET"),
  metaGraphVersion: read("META_GRAPH_VERSION") ?? "v23.0",
  /** Quando "true", nenhuma chamada real é feita à Meta (mensagens só são registradas). */
  whatsappDryRun: read("WHATSAPP_DRY_RUN") === "true",
  whatsappTestRecipient: read("WHATSAPP_TEST_RECIPIENT"),
  whatsappProductionRecipient: read("WHATSAPP_PRODUCTION_RECIPIENT"),

  // Claude
  claudeApiKey: read("CLAUDE_API_KEY") ?? read("ANTHROPIC_API_KEY"),
  claudeModel: read("CLAUDE_MODEL") ?? "claude-opus-5-5",
};

export type Integration = "database" | "whatsapp" | "claude" | "session" | "cron";

/** Diagnóstico do que está configurado — exibido no painel, sem revelar valores. */
export function integrationStatus(): Record<Integration, { ok: boolean; missing: string[] }> {
  const check = (pairs: [string, string | undefined][]) => {
    const missing = pairs.filter(([, v]) => !v).map(([k]) => k);
    return { ok: missing.length === 0, missing };
  };
  return {
    database: check([["DATABASE_URL", env.databaseUrl]]),
    session: check([["SESSION_SECRET", env.sessionSecret]]),
    whatsapp: check([
      ["META_WHATSAPP_TOKEN", env.metaToken],
      ["META_PHONE_NUMBER_ID", env.metaPhoneNumberId],
      ["META_VERIFY_TOKEN", env.metaVerifyToken],
      ["META_APP_SECRET", env.metaAppSecret],
    ]),
    claude: check([["CLAUDE_API_KEY", env.claudeApiKey]]),
    cron: check([["CRON_SECRET", env.cronSecret]]),
  };
}
