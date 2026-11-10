import Link from "next/link";
import { listConversations } from "@/lib/server/conversations";
import { formatPhonePretty } from "@/lib/phone";
import { instantToLocal } from "@/lib/time";
import { AutoRefresh } from "@/components/admin/client";
import { Badge, EmptyState, PageHeader, StatusBadge } from "@/components/admin/ui";

export default async function ConversasPage() {
  const list = await listConversations();
  return (
    <>
      <AutoRefresh seconds={10} />
      <PageHeader title="Conversas do WhatsApp" subtitle="Conversas que pedem atenção aparecem primeiro. Atualiza a cada 10 s." />
      {list.length === 0 ? (
        <EmptyState>Nenhuma conversa ainda. Use o Simulador para testar o assistente.</EmptyState>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-md border border-line bg-ink-2">
          {list.map((c) => {
            const last = c.last_message_at ? instantToLocal(new Date(c.last_message_at)) : null;
            return (
              <li key={c.id}>
                <Link href={`/admin/conversas/${c.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 transition hover:bg-ink-3">
                  <span className="relative">
                    {c.needs_attention && <span className="absolute -top-0.5 -left-2.5 size-2 rounded-full bg-ember" aria-label="Precisa de atenção" />}
                    <span className="font-semibold text-ice">{c.customer_name ?? formatPhonePretty(c.customer_phone)}</span>
                  </span>
                  {c.customer_name && <span className="text-xs text-mute">{formatPhonePretty(c.customer_phone)}</span>}
                  <StatusBadge status={c.status} />
                  {c.is_test && <Badge tone="gold">teste</Badge>}
                  {c.unread_count > 0 && <Badge tone="ember">{c.unread_count} não lida(s)</Badge>}
                  <span className="ml-auto text-xs text-mute-2 tabular-nums">{last ? `${last.date.split("-").reverse().join("/")} ${last.time}` : ""}</span>
                  <span className="w-full truncate text-sm text-mute">{c.last_message}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
