import Link from "next/link";
import { db } from "@/lib/server/db";
import { getMessages } from "@/lib/server/conversations";
import { integrationStatus } from "@/lib/server/env";
import { SIMULATOR_PHONE } from "@/lib/whatsapp/config";
import { ScrollToEnd, SubmitButton } from "@/components/admin/client";
import { btn, Card, Flash, inputCls, PageHeader, StatusBadge } from "@/components/admin/ui";
import { resetSimulatorAction, simulateMessageAction } from "../../actions";
import { MessageList } from "../conversas/MessageList";

const examples = [
  "Oi, quero cortar amanhã",
  "Quanto custa cabelo e barba?",
  "Tem algum horário depois das 16h?",
  "Preciso cancelar meu agendamento",
  "Quero falar com o barbeiro",
];

export default async function SimuladorPage({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const sp = await searchParams;
  const { rows } = await db.query<{ id: string; status: string }>(
    `select cv.id, cv.status from conversations cv join customers c on c.id = cv.customer_id where c.phone = $1`,
    [SIMULATOR_PHONE],
  );
  const conv = rows[0];
  const messages = conv ? await getMessages(conv.id, 200) : [];
  const claude = integrationStatus().claude;

  return (
    <>
      <PageHeader
        title="Simulador de conversa"
        subtitle="Converse com o assistente como se fosse um cliente. Usa a IA e a agenda reais, sem enviar nada pelo WhatsApp. Agendamentos criados aqui ficam marcados como teste."
        actions={
          <form action={resetSimulatorAction}>
            <SubmitButton className={btn.outline} confirm="Apagar a conversa e os agendamentos do simulador?">
              Reiniciar simulação
            </SubmitButton>
          </form>
        }
      />
      <Flash ok={sp.ok} erro={sp.erro} />
      {!claude.ok && (
        <p className="mb-4 rounded-sm border border-ember/40 bg-ember/10 p-3 text-sm text-[#ffb59e]">
          CLAUDE_API_KEY não configurada: o assistente não responde e a conversa é transferida para a equipe (comportamento de segurança).
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <div className="flex min-h-[60dvh] flex-col rounded-md border border-line bg-ink-2">
          <MessageList id="sim" messages={messages} />
          <ScrollToEnd id="sim" />
          <form action={simulateMessageAction} className="flex gap-2 border-t border-line p-3">
            <input name="text" required autoFocus autoComplete="off" placeholder="Escreva como cliente…" className={`${inputCls} flex-1`} />
            <SubmitButton className={btn.gold}>Enviar</SubmitButton>
          </form>
        </div>
        <div className="space-y-4">
          <Card title="Estado">
            {conv ? (
              <div className="space-y-3 text-sm">
                <StatusBadge status={conv.status} />
                <Link href={`/admin/conversas/${conv.id}`} className="block text-gold hover:underline">
                  Abrir no painel de conversas
                </Link>
              </div>
            ) : (
              <p className="text-sm text-mute">Envie a primeira mensagem.</p>
            )}
          </Card>
          <Card title="Exemplos">
            <div className="grid gap-2">
              {examples.map((e) => (
                <form key={e} action={simulateMessageAction}>
                  <input type="hidden" name="text" value={e} />
                  <SubmitButton className={`${btn.small} w-full justify-start text-left`}>{e}</SubmitButton>
                </form>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
