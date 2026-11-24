"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <div>
        <label htmlFor="identificador" className="text-sm font-semibold">
          E-mail institucional ou n.º de funcionário
        </label>
        <input
          id="identificador"
          name="identificador"
          autoComplete="username"
          autoCapitalize="none"
          required
          className="mt-1 min-h-11 w-full rounded-control border border-border bg-surface px-3 text-base"
        />
      </div>
      <div>
        <label htmlFor="password" className="text-sm font-semibold">
          Palavra-passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 min-h-11 w-full rounded-control border border-border bg-surface px-3 text-base"
        />
      </div>
      {state.erro && (
        <p role="alert" className="rounded-control bg-crit-bg px-3 py-2 text-sm font-semibold text-crit">
          {state.erro}
        </p>
      )}
      <button
        disabled={pending}
        className="min-h-11 rounded-control bg-accent px-4 font-semibold text-white disabled:opacity-60"
      >
        {pending ? "A entrar…" : "Entrar"}
      </button>
    </form>
  );
}
