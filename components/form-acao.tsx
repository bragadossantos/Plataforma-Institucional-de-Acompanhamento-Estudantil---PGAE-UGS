"use client";

import { useHidratado } from "@/components/use-hidratado";
import { useActionState, useEffect, useRef, useTransition } from "react";

export type AcaoState = { erro?: string; ok?: string };
export type Acao = (prev: AcaoState, form: FormData) => Promise<AcaoState>;

/** Formulário de Server Action com mensagem de erro/sucesso e reposição dos campos após sucesso. */
export function FormAcao({
  action,
  submit,
  children,
}: {
  action: Acao;
  submit: string;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState<AcaoState, FormData>(action, {});
  const hidratado = useHidratado();
  const [, startTransition] = useTransition();
  // Envio por onSubmit: o React não limpa os campos depois de um erro (o utilizador não perde o que escreveu).
  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    startTransition(() => formAction(dados));
  }
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} onSubmit={enviar} noValidate className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
      {state.erro && (
        <p role="alert" className="rounded-control bg-crit-bg px-3 py-2 text-sm font-semibold text-crit">
          {state.erro}
        </p>
      )}
      {state.ok && (
        <p role="status" className="rounded-control bg-ok-bg px-3 py-2 text-sm font-semibold text-ok">
          {state.ok}
        </p>
      )}
      <div>
        <button
          disabled={pending || !hidratado}
          className="min-h-11 rounded-control bg-accent px-4 font-semibold text-white disabled:opacity-60"
        >
          {pending ? "A guardar…" : submit}
        </button>
      </div>
    </form>
  );
}
