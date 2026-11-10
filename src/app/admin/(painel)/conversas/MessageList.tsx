import type { MessageRow } from "@/lib/server/conversations";
import { instantToLocal } from "@/lib/time";

const senderLabel: Record<MessageRow["sender"], string> = {
  customer: "Cliente",
  ai: "Assistente (IA)",
  human: "Atendente",
  system: "Sistema",
};

const statusLabel: Record<string, string> = {
  sent: "enviada",
  delivered: "entregue",
  read: "lida",
  failed: "falhou",
  blocked: "bloqueada",
  simulated: "simulação",
  dry_run: "não enviada (dry run)",
};

/** Histórico de mensagens no estilo de conversa. */
export function MessageList({ id, messages }: { id: string; messages: MessageRow[] }) {
  return (
    <ol id={id} className="flex max-h-[65dvh] flex-1 flex-col gap-3 overflow-y-auto p-4">
      {messages.length === 0 && <li className="m-auto text-sm text-mute">Sem mensagens.</li>}
      {messages.map((m) => {
        const inbound = m.direction === "inbound";
        const t = instantToLocal(new Date(m.created_at));
        return (
          <li key={m.id} className={`flex ${inbound ? "justify-start" : "justify-end"}`}>
            <div
              className={`max-w-[85%] rounded-lg px-3.5 py-2.5 text-sm whitespace-pre-wrap ${
                inbound
                  ? "rounded-tl-none bg-ink-3 text-ice"
                  : m.sender === "human"
                    ? "rounded-tr-none border border-gold/40 bg-gold/15 text-ice"
                    : m.sender === "system"
                      ? "rounded-tr-none border border-line bg-ink text-mute"
                      : "rounded-tr-none bg-[#1f2a22] text-ice"
              }`}
            >
              <p className="mb-1 text-[0.65rem] font-semibold tracking-wide text-mute">{senderLabel[m.sender]}</p>
              {m.content}
              <p className="mt-1 text-right text-[0.62rem] text-mute-2">
                {t.time}
                {!inbound && statusLabel[m.status] ? ` · ${statusLabel[m.status]}` : ""}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
