import { db, type Queryable } from "./db";
import { env } from "./env";

export type ReminderTemplates = {
  confirmation: string | null;
  reminder_24h: string | null;
  reminder_2h: string | null;
  cancellation: string | null;
  admin_alert: string | null;
  language: string;
};

export type Settings = {
  whatsapp_mode: "test" | "production";
  test_recipient: string;
  production_recipient: string;
  ai_enabled: boolean;
  slot_interval_minutes: number;
  min_notice_minutes: number;
  max_days_ahead: number;
  assistant_extra_instructions: string;
  greeting_message: string;
  handoff_message: string;
  reminder_templates: ReminderTemplates;
};

export const DEFAULT_SETTINGS: Settings = {
  whatsapp_mode: "test",
  test_recipient: "",
  production_recipient: "5579999345023",
  ai_enabled: true,
  slot_interval_minutes: 15,
  min_notice_minutes: 60,
  max_days_ahead: 30,
  assistant_extra_instructions: "",
  greeting_message: "",
  handoff_message:
    "Certo! Já avisei a equipe da Barbearia Ojuara e um atendente vai continuar a conversa com você por aqui assim que possível. 💈",
  reminder_templates: {
    confirmation: null,
    reminder_24h: null,
    reminder_2h: null,
    cancellation: null,
    admin_alert: null,
    language: "pt_BR",
  },
};

export async function getSettings(q: Queryable = db): Promise<Settings> {
  const { rows } = await q.query<{ key: string; value: unknown }>("select key, value from settings");
  const s: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const r of rows) if (r.key in DEFAULT_SETTINGS) s[r.key] = r.value;
  const result = s as Settings;
  // Variáveis de ambiente servem de padrão para os números quando o painel estiver vazio.
  if (!result.test_recipient && env.whatsappTestRecipient) result.test_recipient = env.whatsappTestRecipient;
  if (!result.production_recipient && env.whatsappProductionRecipient) result.production_recipient = env.whatsappProductionRecipient;
  return result;
}

export async function setSetting<K extends keyof Settings>(key: K, value: Settings[K], q: Queryable = db) {
  await q.query(
    `insert into settings (key, value) values ($1, $2::jsonb)
     on conflict (key) do update set value = excluded.value`,
    [key, JSON.stringify(value)],
  );
}
