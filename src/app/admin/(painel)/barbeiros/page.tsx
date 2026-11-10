import { listBarbers, type BarberRow } from "@/lib/server/booking";
import { WEEKDAYS_PT } from "@/lib/time";
import { SubmitButton } from "@/components/admin/client";
import { Badge, btn, Card, EmptyState, Field, Flash, inputCls, PageHeader } from "@/components/admin/ui";
import { deleteBarberAction, saveBarberAction } from "../../actions";

export default async function BarbeirosPage({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const sp = await searchParams;
  const barbers = await listBarbers({ includeInactive: true });
  return (
    <>
      <PageHeader
        title="Barbeiros"
        subtitle="Jornada de cada profissional. Dois turnos por dia; o intervalo entre eles é tratado como pausa."
      />
      <Flash ok={sp.ok} erro={sp.erro} />
      <div className="space-y-4">
        {barbers.length === 0 && <EmptyState>Nenhum barbeiro cadastrado ainda.</EmptyState>}
        {barbers.map((b) => (
          <details key={b.id} className="rounded-md border border-line bg-ink-2">
            <summary className="flex cursor-pointer flex-wrap items-center gap-3 px-5 py-4">
              <span className="font-semibold text-ice">{b.name}</span>
              <span className="text-sm text-mute">
                {Object.keys(b.working_hours ?? {})
                  .map((d) => WEEKDAYS_PT[Number(d)].slice(0, 3))
                  .join(", ") || "sem jornada"}
              </span>
              <span className="ml-auto">{b.active ? <Badge tone="green">Ativo</Badge> : <Badge>Inativo</Badge>}</span>
            </summary>
            <div className="border-t border-line p-5">
              <BarberForm b={b} />
              <form action={deleteBarberAction} className="mt-3">
                <input type="hidden" name="id" value={b.id} />
                <SubmitButton className={btn.danger} confirm="Remover este barbeiro? O histórico é mantido.">
                  Remover barbeiro
                </SubmitButton>
              </form>
            </div>
          </details>
        ))}
        <Card title="Novo barbeiro">
          <BarberForm />
        </Card>
      </div>
    </>
  );
}

function BarberForm({ b }: { b?: BarberRow }) {
  return (
    <form action={saveBarberAction} className="grid gap-4">
      <input type="hidden" name="id" value={b?.id ?? ""} />
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem_auto] sm:items-end">
        <Field label="Nome">
          <input name="name" required defaultValue={b?.name} className={inputCls} />
        </Field>
        <Field label="Ordem">
          <input name="sortOrder" type="number" defaultValue={b?.sort_order ?? 0} className={inputCls} />
        </Field>
        <label className="flex h-11 items-center gap-2 text-sm text-ice">
          <input type="checkbox" name="active" defaultChecked={b?.active ?? true} className="size-4 accent-[#c9a44c]" /> Ativo
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-sm">
          <thead>
            <tr className="text-left text-xs text-mute">
              <th className="py-2 font-semibold">Dia</th>
              <th className="font-semibold">1º turno</th>
              <th className="font-semibold">2º turno (opcional)</th>
            </tr>
          </thead>
          <tbody>
            {WEEKDAYS_PT.map((day, d) => {
              const shifts = b?.working_hours?.[String(d)] ?? [];
              return (
                <tr key={d} className="border-t border-line">
                  <td className="py-2 pr-3 text-ice capitalize">{day}</td>
                  {[0, 1].map((i) => (
                    <td key={i} className="py-2 pr-3">
                      <div className="flex items-center gap-1.5">
                        <input type="time" name={`d${d}_s${i + 1}_start`} defaultValue={shifts[i]?.start} className={`${inputCls} h-9 w-28`} aria-label={`${day} turno ${i + 1} início`} />
                        <span className="text-mute-2">–</span>
                        <input type="time" name={`d${d}_s${i + 1}_end`} defaultValue={shifts[i]?.end} className={`${inputCls} h-9 w-28`} aria-label={`${day} turno ${i + 1} fim`} />
                      </div>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-mute-2">Deixe em branco os dias em que o profissional não atende.</p>
      <SubmitButton className={`${btn.gold} sm:w-fit`}>{b ? "Salvar alterações" : "Cadastrar barbeiro"}</SubmitButton>
    </form>
  );
}
