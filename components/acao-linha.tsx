"use client";

import { useHidratado } from "@/components/use-hidratado";
import { useActionState } from "react";
import type { Acao, AcaoState } from "./form-acao";

/** Botão de ação sobre uma linha (id escondido) que mostra o resultado, incl. mensagens de uma só vez. */
export function AcaoLinha({
  action,
  id,
  label,
  extra,
}: {
  action: Acao;
  id: number;
  label: string;
  /** Campos escondidos adicionais, ex.: { visivel: "1" } */
  extra?: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState<AcaoState, FormData>(action, {});
  const hidratado = useHidratado();
  return (
    <form action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="id" value={id} />
      {extra && Object.entries(extra).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <button
        disabled={pending || !hidratado}
        className="min-h-11 rounded-control border border-border px-3 text-sm font-semibold hover:bg-bg disabled:opacity-60"
      >
        {label}
      </button>
      {state.erro && (
        <p role="alert" className="text-xs font-semibold text-crit">
          {state.erro}
        </p>
      )}
      {state.ok && (
        <p role="status" className="rounded-control bg-ok-bg px-2 py-1 text-xs font-semibold text-ok">
          {state.ok}
        </p>
      )}
    </form>
  );
}
