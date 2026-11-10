import Link from "next/link";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { listAppointmentsBetween } from "@/lib/server/booking";
import { db } from "@/lib/server/db";
import { integrationStatus } from "@/lib/server/env";
import { getSettings } from "@/lib/server/settings";
import { resolveMode } from "@/lib/whatsapp/config";
import { addDays, formatDatePt, todayLocal } from "@/lib/time";
import { AutoRefresh } from "@/components/admin/client";
import { Badge, Card, EmptyState, PageHeader, SourceBadge, Stat, StatusBadge } from "@/components/admin/ui";

function upcomingOnly<T extends { end_at: Date; status: string }>(list: T[]): T[] {
  const now = Date.now();
  return list.filter((a) => new Date(a.end_at).getTime() > now && ["pending", "confirmed", "in_progress"].includes(a.status));
}

export default async function Dashboard() {
  const today = todayLocal();
  const [todayList, upcoming, stats, settings] = await Promise.all([
    listAppointmentsBetween(today, today, { includeCancelled: true }),
    listAppointmentsBetween(today, addDays(today, 7)),
    db.query<{ customers: number; cancel_week: number; walkin_today: number; attention: number; ai_conv: number; msgs_today: number }>(
      `select
         (select count(*)::int from customers where not is_test) as customers,
         (select count(*)::int from appointments where status = 'cancelled' and cancelled_at > now() - interval '7 days') as cancel_week,
         (select count(*)::int from appointments where source = 'walk_in' and appointment_date = $1) as walkin_today,
         (select count(*)::int from conversations where needs_attention) as attention,
         (select count(*)::int from conversations where status in ('AI_ACTIVE','AI_RESUMED') and last_message_at > now() - interval '7 days') as ai_conv,
         (select count(*)::int from messages where direction = 'inbound' and created_at > now() - interval '24 hours') as msgs_today`,
      [today],
    ),
    getSettings(),
  ]);
  const s = stats.rows[0];
  const active = todayList.filter((a) => a.status !== "cancelled");
  const next = upcomingOnly(upcoming).slice(0, 8);
  const integrations = integrationStatus();
  const mode = resolveMode(settings);

  return (
    <>
      <AutoRefresh seconds={30} />
      <PageHeader title="Dashboard" subtitle={`Hoje é ${formatDatePt(today)}.`} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Agendamentos hoje" value={active.length} tone="gold" />
        <Stat label="Presenciais hoje" value={s.walkin_today} />
        <Stat label="Cancelamentos (7 dias)" value={s.cancel_week} tone={s.cancel_week ? "ember" : "default"} />
        <Stat label="Clientes cadastrados" value={s.customers} hint="Sem contar contatos de teste" />
        <Stat label="Conversas pedindo atenção" value={s.attention} tone={s.attention ? "ember" : "default"} />
        <Stat label="Conversas com a IA (7 dias)" value={s.ai_conv} />
        <Stat label="Mensagens recebidas (24 h)" value={s.msgs_today} />
        <Stat label="Modo" value={settings.whatsapp_mode === "test" ? "Teste" : "Produção"} tone={settings.whatsapp_mode === "test" ? "gold" : "default"} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card title="Próximos atendimentos" actions={<Link href="/admin/agenda" className="text-xs text-gold hover:underline">Abrir agenda</Link>}>
          {next.length === 0 ? (
            <EmptyState>Nenhum atendimento nos próximos 7 dias.</EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {next.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 text-sm">
                  <span className="w-28 font-semibold text-gold tabular-nums">
                    {a.appointment_date === today ? "Hoje" : a.appointment_date.slice(8, 10) + "/" + a.appointment_date.slice(5, 7)} {a.start_time}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-ice">
                    {a.customer_name ?? "Cliente"} · {a.service_name}
                  </span>
                  <span className="text-mute">{a.barber_name}</span>
                  <SourceBadge source={a.source} />
                  <StatusBadge status={a.status} />
                  {a.is_test && <Badge tone="gold">teste</Badge>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Integrações">
          <ul className="space-y-3 text-sm">
            {(
              [
                ["Banco de dados (Supabase)", integrations.database],
                ["Sessão do painel", integrations.session],
                ["WhatsApp Cloud API (Meta)", integrations.whatsapp],
                ["Claude API (assistente)", integrations.claude],
                ["Lembretes (cron)", integrations.cron],
              ] as const
            ).map(([label, st]) => (
              <li key={label} className="flex items-start gap-3">
                {st.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#ff8a66]" />}
                <span>
                  <span className="text-ice">{label}</span>
                  {!st.ok && <span className="block text-xs text-mute">Falta: {st.missing.join(", ")}</span>}
                </span>
              </li>
            ))}
            <li className="flex items-start gap-3">
              {mode.mode === "production" || mode.testRecipient.ok ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#ff8a66]" />
              )}
              <span>
                <span className="text-ice">Número de teste</span>
                {mode.mode === "test" && !mode.testRecipient.ok && <span className="block text-xs text-mute">{mode.testRecipient.reason}</span>}
              </span>
            </li>
          </ul>
          <Link href="/admin/configuracoes" className="mt-5 inline-block text-xs text-gold hover:underline">
            Ver configurações
          </Link>
        </Card>
      </div>
    </>
  );
}
