"use client";

import { useActionState } from "react";
import { loginAction } from "../actions";
import { SubmitButton } from "@/components/admin/client";
import { btn, inputCls } from "@/components/admin/ui";

export function LoginForm() {
  const [state, action] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="mt-6 grid gap-4">
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold text-mute">E-mail</span>
        <input name="email" type="email" required autoComplete="username" defaultValue={state?.email} className={inputCls} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold text-mute">Senha</span>
        <input name="password" type="password" required autoComplete="current-password" className={inputCls} />
      </label>
      {state?.error && (
        <p role="alert" className="text-sm text-[#ff9b7d]">
          {state.error}
        </p>
      )}
      <SubmitButton className={`${btn.gold} mt-2 w-full`}>Entrar</SubmitButton>
    </form>
  );
}
