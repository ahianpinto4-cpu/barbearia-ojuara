import type { Metadata } from "next";
import { Logo } from "@/components/ui/Logo";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Painel | Barbearia Ojuara", robots: { index: false, follow: false } };

export default function LoginPage() {
  return (
    <main className="grain flex min-h-dvh items-center justify-center bg-ink px-5 py-16">
      <div className="w-full max-w-sm">
        <Logo variant="header" priority className="mx-auto h-16 w-auto" />
        <div className="mt-10 rounded-md border border-line bg-ink-2 p-7">
          <h1 className="font-display text-2xl text-ice">Painel da barbearia</h1>
          <p className="mt-1 text-sm text-mute">Acesso restrito à equipe da Ojuara.</p>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
