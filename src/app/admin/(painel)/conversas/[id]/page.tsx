import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bot, Hand, Pause, Play } from "lucide-react";
import { isUuid, listCustomerUpcoming } from "@/lib/server/booking";
import { getConversation, getMessages, withinCustomerWindow } from "@/lib/server/conversations";
import { formatPhonePretty } from "@/lib/phone";
import { formatDatePt, instantToLocal } from "@/lib/time";
import { AutoRefresh, ScrollToEnd, SubmitButton } from "@/components/admin/client";
import { Badge, btn, Card, Flash, inputCls, StatusBadge } from "@/components/admin/ui";
import { conversationAction, sendHumanMessageAction } from "../../../actions";
import { MessageList } from "../MessageList";

export default async function ConversaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  if (!isUuid(id)) notFound();
  const conv = await getConversation(id);
  if (!conv) notFound();
  const [messages, upcoming] = await Promise.all([getMessages(id, 200), listCustomerUpcoming(conv.customer_id)]);
  const open = withinCustomerWindow(conv.last_inbound_at);
  const op = (value: string, label: React.ReactNode, cls = btn.outline) => (
    <form action={conversationAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="op" value={value} />
      <SubmitButton className={cls}>{label}</SubmitButton>
    </form>
  );

  return (
    <>
      <AutoRefresh seconds={8} />
      <Link href="/admin/conversas" className="mb-4 inline-flex items-center gap-2 text-sm text-mute hover:text-gold">
        <ArrowLeft className="size-4" /> Conversas
      </Link>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl text-ice">{conv.customer_name ?? "Cliente sem nome"}</h1>
        <span className="text-sm text-mute">{formatPhonePretty(conv.customer_phone)}</span>
        <StatusBadge status={conv.status} />
        {conv.is_test && <Badge tone="gold">teste</Badge>}
      </div>
      <Flash ok={sp.ok} erro={sp.erro} />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="flex min-h-[60dvh] flex-col rounded-md border border-line bg-ink-2">
          <MessageList id="msgs" messages={messages} />
          <ScrollToEnd id="msgs" />
          <form action={sendHumanMessageAction} className="border-t border-line p-3">
            <input type="hidden" name="id" value={id} />
            <div className="flex gap-2">
              <textarea name="text" rows={2} required placeholder="Responder como atendente…" className={`${inputCls} h-auto flex-1 py-2`} />
              <SubmitButton className={btn.gold}>Enviar</SubmitButton>
            </div>
            <p className="mt-2 text-xs text-mute-2">
              Ao responder, você assume a conversa e a IA fica pausada.{" "}
              {!open && "Atenção: fora da janela de 24 h, a Meta só permite mensagens com template aprovado."}
            </p>
          </form>
        </div>

        <div className="space-y-4">
          <Card title="Atendimento">
            {conv.handoff_reason && ["HUMAN_REQUESTED", "HUMAN_ACTIVE"].includes(conv.status) && (
              <p className="mb-4 rounded-sm border border-ember/40 bg-ember/10 p-3 text-xs text-[#ffb59e]">Motivo: {conv.handoff_reason}</p>
            )}
            <div className="grid gap-2">
              {conv.status !== "HUMAN_ACTIVE" &&
                op("assume", (
                  <>
                    <Hand className="size-4" /> Assumir conversa
                  </>
                ), btn.gold)}
              {!["AI_PAUSED", "HUMAN_ACTIVE", "HUMAN_REQUESTED"].includes(conv.status) &&
                op("pause", (
                  <>
                    <Pause className="size-4" /> Pausar IA
                  </>
                ))}
              {["AI_PAUSED", "HUMAN_ACTIVE", "HUMAN_REQUESTED"].includes(conv.status) &&
                op("resume", (
                  <>
                    <Play className="size-4" /> Reativar IA
                  </>
                ))}
              {conv.unread_count > 0 && op("read", "Marcar como lida")}
            </div>
            <p className="mt-4 flex gap-2 text-xs text-mute-2">
              <Bot className="size-4 shrink-0" />
              {["HUMAN_REQUESTED", "HUMAN_ACTIVE", "AI_PAUSED"].includes(conv.status)
                ? "A IA não está respondendo esta conversa."
                : "A IA responde automaticamente."}
              {conv.assigned_to ? ` Responsável: ${conv.assigned_to}.` : ""}
            </p>
          </Card>
          <Card title="Próximos agendamentos">
            {upcoming.length === 0 ? (
              <p className="text-sm text-mute">Nenhum.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {upcoming.map((a) => (
                  <li key={a.id} className="rounded-sm border border-line p-2">
                    <span className="text-gold">{formatDatePt(a.appointment_date)}</span> às {a.start_time}
                    <span className="block text-mute">
                      {a.service_name} · {a.barber_name}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <p className="text-xs text-mute-2">
            Última mensagem do cliente:{" "}
            {conv.last_inbound_at ? (() => {
              const l = instantToLocal(new Date(conv.last_inbound_at));
              return `${l.date.split("-").reverse().join("/")} ${l.time}`;
            })() : "—"}{" "}
            · Janela de 24 h {open ? "aberta" : "fechada"}
          </p>
        </div>
      </div>
    </>
  );
}
