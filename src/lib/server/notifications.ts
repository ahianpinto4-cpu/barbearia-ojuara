import { formatDatePt, formatDateShortPt, formatPriceBRL } from "@/lib/time";
import { sendTemplate, sendText } from "@/lib/whatsapp/client";
import { canSendTo, resolveMode } from "@/lib/whatsapp/config";
import { getAppointment } from "./booking";
import { insertOutbound, withinCustomerWindow } from "./conversations";
import { db, getPool } from "./db";
import { logEvent } from "./log";
import { getSettings } from "./settings";

type Job = { id: string; appointment_id: string; kind: "confirmation" | "reminder_24h" | "reminder_2h" | "cancellation"; attempts: number };

const MAX_ATTEMPTS = 3;

function freeformText(kind: Job["kind"], a: NonNullable<Awaited<ReturnType<typeof getAppointment>>>) {
  const when = `${formatDatePt(a.appointment_date)} às ${a.start_time}`;
  switch (kind) {
    case "reminder_24h":
      return `Olá${a.customer_name ? `, ${a.customer_name}` : ""}! Passando para lembrar do seu horário na Barbearia Ojuara amanhã: ${when}, ${a.service_name} com ${a.barber_name}. 💈 Se precisar remarcar, é só responder aqui.`;
    case "reminder_2h":
      return `Seu horário na Barbearia Ojuara é daqui a pouco: ${a.start_time}, com ${a.barber_name}. Estamos esperando por você! ✂️`;
    case "confirmation":
      return `Seu horário foi confirmado com sucesso! 💈\n\n📅 Data: ${formatDateShortPt(a.appointment_date)}\n🕒 Horário: ${a.start_time}\n✂️ Serviço: ${a.service_name}\n👤 Profissional: ${a.barber_name}\n💰 Valor: ${formatPriceBRL(a.price)}\n\nA Barbearia Ojuara agradece sua preferência!`;
    case "cancellation":
      return `Seu horário de ${when} na Barbearia Ojuara foi cancelado. Se quiser marcar outro, é só responder aqui. 💈`;
  }
}

/**
 * Envia notificações vencidas. Chamado pelo cron (/api/cron/reminders).
 * - Usa template aprovado quando configurado (obrigatório fora da janela de 24 h).
 * - Sem template, só envia texto livre dentro da janela de 24 h.
 * - Cada job é travado (FOR UPDATE SKIP LOCKED) e nunca é enviado duas vezes.
 */
export async function processDueNotifications(limit = 30) {
  const settings = await getSettings();
  const mode = resolveMode(settings);
  const tpl = settings.reminder_templates;
  const summary = { sent: 0, skipped: 0, failed: 0, cancelled: 0 };

  for (let i = 0; i < limit; i++) {
    const client = await getPool().connect();
    try {
      await client.query("begin");
      const { rows } = await client.query<Job>(
        `select id, appointment_id, kind, attempts from notification_jobs
         where status = 'pending' and scheduled_for <= now()
         order by scheduled_for for update skip locked limit 1`,
      );
      const job = rows[0];
      if (!job) {
        await client.query("commit");
        break;
      }
      const finish = (status: string, extra: { error?: string; waId?: string | null } = {}) =>
        client.query(
          `update notification_jobs set status = $2::job_status, attempts = attempts + 1, last_error = $3,
             whatsapp_message_id = coalesce($4, whatsapp_message_id), sent_at = case when $2::text = 'sent' then now() else sent_at end
           where id = $1`,
          [job.id, status, extra.error ?? null, extra.waId ?? null],
        );

      const appt = await getAppointment(job.appointment_id, client);
      const stillValid =
        appt &&
        appt.customer_phone &&
        (job.kind === "cancellation" ? appt.status === "cancelled" : ["pending", "confirmed"].includes(appt.status));
      if (!appt || !stillValid) {
        await finish("cancelled", { error: "Agendamento não está mais ativo" });
        summary.cancelled++;
        await client.query("commit");
        continue;
      }
      if (appt.is_test !== (mode.mode === "test") && mode.mode === "production") {
        await finish("skipped", { error: "Agendamento de teste em modo produção" });
        summary.skipped++;
        await client.query("commit");
        continue;
      }
      const allowed = canSendTo(mode, appt.customer_phone!);
      if (!allowed.ok) {
        await finish("skipped", { error: allowed.reason });
        summary.skipped++;
        await client.query("commit");
        continue;
      }

      const { rows: convRows } = await client.query<{ id: string; last_inbound_at: Date | null }>(
        `select cv.id, cv.last_inbound_at from conversations cv where cv.customer_id = $1`,
        [appt.customer_id],
      );
      const conv = convRows[0];
      const templateName = tpl[job.kind];
      const text = freeformText(job.kind, appt);
      let res;
      if (templateName) {
        res = await sendTemplate(appt.customer_phone!, templateName, tpl.language, [
          appt.customer_name ?? "cliente",
          formatDateShortPt(appt.appointment_date),
          appt.start_time,
          appt.service_name,
          appt.barber_name,
        ]);
      } else if (conv && withinCustomerWindow(conv.last_inbound_at)) {
        res = await sendText(appt.customer_phone!, text);
      } else {
        await finish("skipped", { error: `Sem template aprovado configurado para "${job.kind}" e fora da janela de 24 h.` });
        summary.skipped++;
        await client.query("commit");
        continue;
      }

      if (res.ok) {
        await finish("sent", { waId: res.id });
        if (conv) await insertOutbound(conv.id, "system", templateName ? `[Template ${templateName}] ${text}` : text, res.dryRun ? "dry_run" : "sent", res.id);
        summary.sent++;
      } else {
        const final = job.attempts + 1 >= MAX_ATTEMPTS || res.error.outsideWindow;
        await client.query(
          `update notification_jobs set status = $2::job_status, attempts = attempts + 1, last_error = $3,
             scheduled_for = case when $2::text = 'pending' then now() + interval '10 minutes' else scheduled_for end where id = $1`,
          [job.id, final ? "failed" : "pending", res.error.message],
        );
        summary.failed++;
      }
      await client.query("commit");
    } catch (err) {
      await client.query("rollback").catch(() => {});
      await logEvent("error", "notifications.error", String(err));
      break;
    } finally {
      client.release();
    }
  }
  if (summary.sent || summary.failed) await logEvent("info", "notifications.run", "Lembretes processados", summary);
  return summary;
}

export async function listRecentJobs(limit = 50) {
  const { rows } = await db.query(
    `select j.id, j.kind, j.status, j.scheduled_for, j.sent_at, j.attempts, j.last_error, c.name as customer_name
     from notification_jobs j join appointments a on a.id = j.appointment_id left join customers c on c.id = a.customer_id
     order by j.scheduled_for desc limit $1`,
    [limit],
  );
  return rows;
}
