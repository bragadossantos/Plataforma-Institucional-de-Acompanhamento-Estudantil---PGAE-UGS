"use client";

import { useActionState, useTransition } from "react";
import { iniciarVotoAction, type VotoState } from "./actions";

const campo = "mt-1 min-h-11 w-full rounded-control border border-border bg-surface px-3 text-base";

export function EntradaForm() {
  const [state, action, pending] = useActionState<VotoState, FormData>(iniciarVotoAction, {});
  const [, startTransition] = useTransition();
  // Envio por onSubmit: o React não limpa os campos depois de um erro (o utilizador não perde o que escreveu).
  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    startTransition(() => action(dados));
  }
  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
      <div>
        <label htmlFor="codigo" className="text-sm font-semibold">
          Código da turma
        </label>
        <input
          id="codigo"
          name="codigo"
          placeholder="EI3A-7K9P"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          required
          className={`${campo} font-mono font-medium uppercase`}
        />
      </div>
      <div>
        <label htmlFor="numero" className="text-sm font-semibold">
          N.º de estudante
        </label>
        <input
          id="numero"
          name="numero"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          required
          className={campo}
        />
      </div>

      {/* Honeypot: invisível para pessoas e leitores de ecrã; bots preenchem-no. */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="website">Não preencher</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {state.erro && (
        <p role="alert" className="rounded-control bg-crit-bg px-3 py-2 text-sm font-semibold text-crit">
          {state.erro}
        </p>
      )}
      <button
        disabled={pending}
        className="min-h-12 rounded-control bg-accent px-4 text-lg font-semibold text-white disabled:opacity-60"
      >
        {pending ? "A verificar…" : "Continuar"}
      </button>
    </form>
  );
}
