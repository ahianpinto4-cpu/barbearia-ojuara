import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, FlaskConical, LayoutDashboard, LogOut, MessageCircle, Scissors, Settings, Users } from "lucide-react";
import { requireAdmin } from "@/lib/server/auth";
import { db, isDatabaseConfigured } from "@/lib/server/db";
import { getSettings } from "@/lib/server/settings";
import { Logo } from "@/components/ui/Logo";
import { logoutAction } from "../actions";

export const metadata: Metadata = { title: "Painel | Barbearia Ojuara", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const nav = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/admin/conversas", label: "Conversas", icon: MessageCircle, badge: true },
  { href: "/admin/servicos", label: "Serviços", icon: Scissors },
  { href: "/admin/barbeiros", label: "Barbeiros", icon: Users },
  { href: "/admin/simulador", label: "Simulador", icon: FlaskConical },
  { href: "/admin/configuracoes", label: "Configurações", icon: Settings },
];

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  if (!isDatabaseConfigured()) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-ink p-6 text-center text-mute">
        Banco de dados não configurado. Defina DATABASE_URL (veja o README).
      </main>
    );
  }
  const admin = await requireAdmin();
  const [{ rows }, settings] = await Promise.all([
    db.query<{ n: number }>(`select count(*)::int as n from conversations where needs_attention`),
    getSettings(),
  ]);
  const attention = rows[0]?.n ?? 0;
  const isTest = settings.whatsapp_mode === "test";

  return (
    <div className="min-h-dvh bg-ink text-ice lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="sticky top-0 z-30 border-b border-line bg-ink-2/95 backdrop-blur lg:h-dvh lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between gap-3 px-4 py-3 lg:block lg:px-5 lg:py-6">
          <Link href="/admin" aria-label="Painel">
            <Logo variant="header" priority className="h-9 w-auto lg:h-12" />
          </Link>
          <form action={logoutAction} className="lg:hidden">
            <button className="grid size-10 place-items-center rounded-full border border-line text-mute" aria-label="Sair">
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
        <nav aria-label="Painel" className="overflow-x-auto px-2 pb-2 lg:px-3">
          <ul className="flex gap-1 lg:flex-col">
            {nav.map(({ href, label, icon: Icon, badge }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="flex min-h-10 items-center gap-3 rounded-sm px-3 text-sm whitespace-nowrap text-mute transition hover:bg-ink-3 hover:text-ice"
                >
                  <Icon className="size-4 text-gold" aria-hidden />
                  {label}
                  {badge && attention > 0 && (
                    <span className="ml-auto grid min-w-5 place-items-center rounded-full bg-ember px-1.5 text-[0.65rem] font-bold text-white">
                      {attention}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="hidden px-5 pt-6 lg:block">
          <p className="text-xs text-mute-2">Conectado como</p>
          <p className="truncate text-sm text-ice">{admin.name}</p>
          <form action={logoutAction} className="mt-3">
            <button className="inline-flex items-center gap-2 text-xs text-mute hover:text-gold">
              <LogOut className="size-3.5" /> Sair
            </button>
          </form>
        </div>
      </aside>
      <div className="min-w-0">
        {isTest && (
          <div className="border-b border-gold/30 bg-gold/10 px-5 py-2 text-center text-xs font-semibold tracking-wide text-gold">
            MODO TESTE — o assistente só conversa com o número autorizado. Agendamentos ficam marcados como teste.
          </div>
        )}
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
