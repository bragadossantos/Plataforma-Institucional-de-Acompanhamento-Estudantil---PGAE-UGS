"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { registarAuditoriaAction } from "./actions";
import type { AcaoState } from "@/components/form-acao";

const CAMPO = "mt-1 min-h-11 w-full rounded-control border border-border bg-surface px-3 text-base";

const CATEGORIAS = [
  ["DIDATICA", "Didática"],
  ["AVALIACAO", "Avaliações"],
  ["ASSIDUIDADE", "Assiduidade"],
  ["INFRAESTRUTURA", "Infraestrutura"],
  ["CONDUTA", "Conduta"],
  ["OUTRO", "Outro"],
] as const;

const GRAVIDADES = [
  ["BAIXA", "Baixa", "peer-checked:border-ok peer-checked:bg-ok-bg peer-checked:text-ok"],
  ["MEDIA", "Média", "peer-checked:border-warn peer-checked:bg-warn-bg peer-checked:text-warn"],
  ["ALTA", "Alta", "peer-checked:border-warn peer-checked:bg-warn-bg peer-checked:text-warn"],
  ["CRITICA", "Crítica", "peer-checked:border-crit peer-checked:bg-crit-bg peer-checked:text-crit"],
] as const;

export function AuditoriaForm({ docentes }: { docentes: { id: number; texto: string }[] }) {
  const [state, action, pending] = useActionState<AcaoState, FormData>(registarAuditoriaAction, {});
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    startTransition(() => action(dados));
  }

  return (
    <form ref={ref} onSubmit={enviar} noValidate className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="turmaDocenteId" className="text-sm font-semibold">
            Cadeira / docente
          </label>
          <select id="turmaDocenteId" name="turmaDocenteId" defaultValue="" className={CAMPO}>
            <option value="">Geral (sem docente específico)</option>
            {docentes.map((d) => (
              <option key={d.id} value={d.id}>
                {d.texto}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="categoria" className="text-sm font-semibold">
            Categoria
          </label>
          <select id="categoria" name="categoria" required defaultValue="" className={CAMPO}>
            <option value="" disabled>
              Selecione…
            </option>
            {CATEGORIAS.map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset>
        <legend className="text-sm font-semibold">Gravidade</legend>
        <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {GRAVIDADES.map(([v, t, cls]) => (
            <label key={v} className="block">
              <input type="radio" name="gravidade" value={v} className="peer sr-only" />
              <span
                className={`flex min-h-11 cursor-pointer items-center justify-center rounded-control border border-border bg-surface font-semibold peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand ${cls}`}
              >
                {t}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="titulo" className="text-sm font-semibold">
          Título
        </label>
        <input id="titulo" name="titulo" maxLength={140} required autoComplete="off" className={CAMPO} />
      </div>

      <div>
        <label htmlFor="descricao" className="text-sm font-semibold">
          Descreva o facto objetivo
        </label>
        <p className="text-xs text-ink-muted">O que aconteceu, quando e onde. Só factos, sem opiniões.</p>
        <textarea
          id="descricao"
          name="descricao"
          rows={5}
          maxLength={4000}
          required
          className="mt-1 w-full rounded-control border border-border bg-surface p-3 text-base"
        />
      </div>

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
          disabled={pending}
          className="min-h-11 rounded-control bg-accent px-4 font-semibold text-white disabled:opacity-60"
        >
          {pending ? "A enviar…" : "Enviar ao GAE"}
        </button>
      </div>
    </form>
  );
}
