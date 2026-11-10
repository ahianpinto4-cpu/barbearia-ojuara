import { listServices, type ServiceRow } from "@/lib/server/booking";
import { formatPriceBRL } from "@/lib/time";
import { SubmitButton } from "@/components/admin/client";
import { Badge, btn, Card, EmptyState, Field, Flash, inputCls, PageHeader } from "@/components/admin/ui";
import { deleteServiceAction, saveServiceAction } from "../../actions";

export default async function ServicosPage({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const sp = await searchParams;
  const services = await listServices({ includeInactive: true });
  return (
    <>
      <PageHeader
        title="Serviços"
        subtitle="Preços e durações usados pelo assistente e pelo site. Serviço ativo precisa ter duração para calcular horários."
      />
      <Flash ok={sp.ok} erro={sp.erro} />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-3">
          {services.length === 0 && <EmptyState>Nenhum serviço cadastrado.</EmptyState>}
          {services.map((s) => (
            <details key={s.id} className="rounded-md border border-line bg-ink-2">
              <summary className="flex cursor-pointer flex-wrap items-center gap-3 px-5 py-4">
                <span className="font-semibold text-ice">{s.name}</span>
                <span className="text-sm text-gold">{formatPriceBRL(s.price)}</span>
                <span className="text-sm text-mute">{s.duration_minutes ? `${s.duration_minutes} min` : "sem duração"}</span>
                <span className="ml-auto">{s.active ? <Badge tone="green">Ativo</Badge> : <Badge>Inativo</Badge>}</span>
              </summary>
              <div className="border-t border-line p-5">
                <ServiceForm s={s} />
                <form action={deleteServiceAction} className="mt-3">
                  <input type="hidden" name="id" value={s.id} />
                  <SubmitButton className={btn.danger} confirm="Remover este serviço? O histórico de agendamentos é mantido.">
                    Remover serviço
                  </SubmitButton>
                </form>
              </div>
            </details>
          ))}
        </div>
        <Card title="Novo serviço">
          <ServiceForm />
        </Card>
      </div>
    </>
  );
}

function ServiceForm({ s }: { s?: ServiceRow }) {
  return (
    <form action={saveServiceAction} className="grid gap-3">
      <input type="hidden" name="id" value={s?.id ?? ""} />
      <Field label="Nome">
        <input name="name" required defaultValue={s?.name} className={inputCls} />
      </Field>
      <Field label="Descrição">
        <textarea name="description" rows={2} defaultValue={s?.description ?? ""} className={`${inputCls} h-auto py-2`} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Preço (R$)" hint="Vazio = sob consulta">
          <input name="price" inputMode="decimal" defaultValue={s?.price ?? ""} className={inputCls} />
        </Field>
        <Field label="Duração (min)">
          <input name="duration" type="number" min={5} max={480} defaultValue={s?.duration_minutes ?? ""} className={inputCls} />
        </Field>
      </div>
      <div className="grid grid-cols-2 items-end gap-3">
        <Field label="Ordem">
          <input name="sortOrder" type="number" defaultValue={s?.sort_order ?? 0} className={inputCls} />
        </Field>
        <label className="flex h-11 items-center gap-2 text-sm text-ice">
          <input type="checkbox" name="active" defaultChecked={s?.active ?? true} className="size-4 accent-[#c9a44c]" /> Ativo
        </label>
      </div>
      <SubmitButton className={btn.gold}>{s ? "Salvar alterações" : "Cadastrar serviço"}</SubmitButton>
    </form>
  );
}
