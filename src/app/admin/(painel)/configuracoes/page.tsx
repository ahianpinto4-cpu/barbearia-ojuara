import { getBusinessHours } from "@/lib/server/booking";
import { env, integrationStatus } from "@/lib/server/env";
import { listRecentJobs } from "@/lib/server/notifications";
import { getSettings } from "@/lib/server/settings";
import { formatPhonePretty } from "@/lib/phone";
import { instantToLocal, WEEKDAYS_PT } from "@/lib/time";
import { resolveMode } from "@/lib/whatsapp/config";
import { SubmitButton } from "@/components/admin/client";
import { Badge, btn, Card, Field, Flash, inputCls, PageHeader } from "@/components/admin/ui";
import {
  purgeTestDataAction,
  saveAssistantSettingsAction,
  saveBusinessHoursAction,
  saveTemplatesAction,
  saveWhatsappSettingsAction,
} from "../../actions";

export default async function ConfiguracoesPage({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const sp = await searchParams;
  const [settings, hours, jobs] = await Promise.all([getSettings(), getBusinessHours(), listRecentJobs(15)]);
  const mode = resolveMode(settings);
  const integ = integrationStatus();
  const byDay = new Map(hours.map((h) => [h.day_of_week, h]));
  const tpl = settings.reminder_templates;

  return (
    <>
      <PageHeader title="Configurações" subtitle="Modo de operação, números, horário de funcionamento e assistente." />
      <Flash ok={sp.ok} erro={sp.erro} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="WhatsApp: teste e produção">
          <form action={saveWhatsappSettingsAction} className="grid gap-4">
            <fieldset className="grid grid-cols-2 gap-2">
              <legend className="mb-2 text-xs font-semibold text-mute">Modo de operação</legend>
              {(["test", "production"] as const).map((m) => (
                <label
                  key={m}
                  className="flex cursor-pointer items-center gap-2 rounded-sm border border-line p-3 text-sm has-[:checked]:border-gold has-[:checked]:bg-gold/10"
                >
                  <input type="radio" name="mode" value={m} defaultChecked={settings.whatsapp_mode === m} className="accent-[#c9a44c]" />
                  {m === "test" ? "Teste" : "Produção"}
                </label>
              ))}
            </fieldset>
            <Field
              label="Número autorizado para TESTE (responsável pelo projeto)"
              hint={
                mode.testRecipient.ok ? (
                  <span className="text-emerald-300">Válido: {formatPhonePretty(mode.testRecipient.phone)}</span>
                ) : (
                  <span className="text-[#ff9b7d]">
                    {mode.testRecipient.reason} O número informado anteriormente (79 9664 8360) tem 10 dígitos e parece incompleto —
                    confirme o número completo.
                  </span>
                )
              }
            >
              <input name="testRecipient" defaultValue={settings.test_recipient} placeholder="55 79 9XXXX-XXXX" className={inputCls} />
            </Field>
            <Field
              label="Número OFICIAL da barbearia (produção e alertas da equipe)"
              hint="Recebe os alertas de atendimento humano no modo produção."
            >
              <input name="productionRecipient" defaultValue={settings.production_recipient} className={inputCls} />
            </Field>
            <p className="rounded-sm border border-line bg-ink p-3 text-xs leading-relaxed text-mute">
              <strong className="text-ice">Origem x destino:</strong> as mensagens saem do número conectado à Cloud API (
              {env.metaPhoneNumberId ? `Phone Number ID ${env.metaPhoneNumberId.slice(0, 4)}…` : "META_PHONE_NUMBER_ID não definido"}). Em
              TESTE, o assistente só conversa com o número autorizado; mensagens de outros números são ignoradas e não são gravadas. Na Meta,
              cadastre esse número em &quot;destinatários de teste&quot; do app.
              {env.whatsappDryRun && <span className="mt-1 block text-gold">WHATSAPP_DRY_RUN ativo: nenhuma mensagem real é enviada.</span>}
            </p>
            <SubmitButton className={btn.gold} confirm="Confirmar alteração do modo/números do WhatsApp?">
              Salvar
            </SubmitButton>
          </form>
        </Card>

        <Card title="Horário de funcionamento">
          <form action={saveBusinessHoursAction} className="grid gap-2">
            {WEEKDAYS_PT.map((day, d) => {
              const h = byDay.get(d);
              return (
                <div key={d} className="grid grid-cols-[6.5rem_1fr_1fr_auto] items-center gap-2 text-sm">
                  <span className="text-ice capitalize">{day.replace("-feira", "")}</span>
                  <input type="time" name={`open_${d}`} defaultValue={h?.opening_time} className={`${inputCls} h-9`} aria-label={`${day} abertura`} />
                  <input type="time" name={`close_${d}`} defaultValue={h?.closing_time} className={`${inputCls} h-9`} aria-label={`${day} fechamento`} />
                  <label className="flex items-center gap-1.5 text-xs text-mute">
                    <input type="checkbox" name={`active_${d}`} defaultChecked={h?.active ?? false} className="accent-[#c9a44c]" /> aberto
                  </label>
                </div>
              );
            })}
            <p className="mt-1 text-xs text-mute-2">
              Sem horário cadastrado, o assistente não oferece horários nesse dia. Preencha somente com os horários reais da barbearia.
            </p>
            <SubmitButton className={`${btn.gold} mt-2`}>Salvar horários</SubmitButton>
          </form>
        </Card>

        <Card title="Assistente virtual">
          <form action={saveAssistantSettingsAction} className="grid gap-4">
            <label className="flex items-center gap-2 text-sm text-ice">
              <input type="checkbox" name="aiEnabled" defaultChecked={settings.ai_enabled} className="size-4 accent-[#c9a44c]" />
              Respostas automáticas da IA ligadas
            </label>
            <Field label="Mensagem de boas-vindas (referência para a IA)">
              <textarea name="greeting" rows={5} defaultValue={settings.greeting_message} className={`${inputCls} h-auto py-2`} />
            </Field>
            <Field label="Mensagem ao transferir para atendimento humano">
              <textarea name="handoff" rows={3} defaultValue={settings.handoff_message} className={`${inputCls} h-auto py-2`} />
            </Field>
            <Field label="Instruções adicionais (ex.: formas de pagamento, regras da casa)" hint="Somente informações verdadeiras.">
              <textarea name="extra" rows={3} defaultValue={settings.assistant_extra_instructions} className={`${inputCls} h-auto py-2`} />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Intervalo (min)">
                <input name="slotInterval" type="number" min={5} max={120} defaultValue={settings.slot_interval_minutes} className={inputCls} />
              </Field>
              <Field label="Antecedência (min)">
                <input name="minNotice" type="number" min={0} max={1440} defaultValue={settings.min_notice_minutes} className={inputCls} />
              </Field>
              <Field label="Agenda (dias)">
                <input name="maxDays" type="number" min={1} max={180} defaultValue={settings.max_days_ahead} className={inputCls} />
              </Field>
            </div>
            <SubmitButton className={btn.gold}>Salvar</SubmitButton>
          </form>
        </Card>

        <Card title="Lembretes e templates da Meta">
          <form action={saveTemplatesAction} className="grid gap-3">
            <p className="text-xs leading-relaxed text-mute">
              Fora da janela de 24 h, a Meta só permite mensagens com <strong className="text-ice">template aprovado</strong>. Informe o nome
              exato de cada template aprovado no WhatsApp Manager. Parâmetros enviados no corpo, nesta ordem: nome, data, horário, serviço,
              profissional. Sem template, o lembrete só é enviado se o cliente tiver falado nas últimas 24 h.
            </p>
            {(
              [
                ["reminder_24h", "Lembrete 24 h antes"],
                ["reminder_2h", "Lembrete 2 h antes"],
                ["confirmation", "Confirmação (agendamentos do painel)"],
                ["cancellation", "Cancelamento pela barbearia"],
                ["admin_alert", "Alerta para a equipe (1 parâmetro: texto)"],
              ] as const
            ).map(([k, label]) => (
              <Field key={k} label={label}>
                <input name={k} defaultValue={tpl[k] ?? ""} placeholder="nome_do_template" className={inputCls} />
              </Field>
            ))}
            <Field label="Idioma do template">
              <input name="language" defaultValue={tpl.language} className={inputCls} />
            </Field>
            <SubmitButton className={btn.gold}>Salvar templates</SubmitButton>
          </form>
          <div className="mt-6">
            <p className="mb-2 text-xs font-semibold text-mute">Últimos envios programados</p>
            <ul className="space-y-1 text-xs">
              {jobs.length === 0 && <li className="text-mute-2">Nenhum.</li>}
              {jobs.map((j) => (
                <li key={j.id as string} className="flex flex-wrap gap-2 text-mute">
                  <Badge tone={j.status === "sent" ? "green" : j.status === "failed" ? "ember" : "gray"}>{String(j.status)}</Badge>
                  {String(j.kind)} · {(j.customer_name as string) ?? "cliente"} ·{" "}
                  {(() => {
                    const l = instantToLocal(new Date(j.scheduled_for as string));
                    return `${l.date.split("-").reverse().join("/")} ${l.time}`;
                  })()}
                  {j.last_error ? <span className="w-full text-mute-2">{String(j.last_error)}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <Card title="Integrações (variáveis de ambiente)">
          <ul className="space-y-2 text-sm">
            {Object.entries(integ).map(([k, v]) => (
              <li key={k} className="flex flex-wrap items-center gap-2">
                <Badge tone={v.ok ? "green" : "ember"}>{v.ok ? "configurado" : "pendente"}</Badge>
                <span className="text-ice">{k}</span>
                {!v.ok && <span className="text-xs text-mute">falta {v.missing.join(", ")}</span>}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-mute-2">
            Valores secretos nunca são exibidos. Configure-os na Vercel (Settings → Environment Variables). Modelo de IA: {env.claudeModel}.
          </p>
        </Card>

        <Card title="Dados de teste">
          <p className="mb-4 text-sm text-mute">Apaga clientes e agendamentos marcados como teste (inclusive os do simulador).</p>
          <form action={purgeTestDataAction}>
            <SubmitButton className={btn.danger} confirm="Apagar todos os dados de teste?">
              Apagar dados de teste
            </SubmitButton>
          </form>
        </Card>
      </div>
    </>
  );
}
