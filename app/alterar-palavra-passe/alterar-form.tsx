"use client";

import { useActionState } from "react";
import { alterarPasswordAction, type AlterarState } from "./actions";

function Campo({ id, label, erro, autoComplete }: { id: string; label: string; erro?: string; autoComplete: string }) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type="password"
        autoComplete={autoComplete}
        required
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? `${id}-erro` : undefined}
        className="mt-1 min-h-11 w-full rounded-control border border-border bg-surface px-3 text-base"
      />
      {erro && (
        <p id={`${id}-erro`} className="mt-1 text-sm font-semibold text-crit">
          {erro}
        </p>
      )}
    </div>
  );
}

export function AlterarForm() {
  const [state, action, pending] = useActionState<AlterarState, FormData>(alterarPasswordAction, {});
  const e = state.erros ?? {};
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Campo id="atual" label="Palavra-passe atual" erro={e.atual} autoComplete="current-password" />
      <Campo id="nova" label="Nova palavra-passe (mín. 8, letras e números)" erro={e.nova} autoComplete="new-password" />
      <Campo id="confirmar" label="Confirmar nova palavra-passe" erro={e.confirmar} autoComplete="new-password" />
      <button
        disabled={pending}
        className="min-h-11 rounded-control bg-accent px-4 font-semibold text-white disabled:opacity-60"
      >
        {pending ? "A guardar…" : "Guardar e continuar"}
      </button>
    </form>
  );
}
