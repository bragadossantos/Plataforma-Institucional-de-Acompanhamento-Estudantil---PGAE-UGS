"use client";

import { useHidratado } from "@/components/use-hidratado";
import { useActionState, useRef, useState, useTransition } from "react";
import { submeterVotoAction, type VotoState } from "../actions";

type Docente = { id: number; disciplina: string; nome: string };

const CRITERIOS = [
  { id: "didatica", label: "Clareza e didática" },
  { id: "avaliacao", label: "Justiça nas avaliações" },
  { id: "pontualidade", label: "Assiduidade e pontualidade" },
  { id: "comunicacao", label: "Comunicação e disponibilidade" },
] as const;

const CATEGORIAS = [
  ["ACADEMICO", "Académico"],
  ["LABORATORIOS", "Laboratórios"],
  ["SECRETARIA", "Secretaria"],
  ["HORARIOS", "Horários"],
  ["INFRAESTRUTURA", "Infraestrutura"],
  ["TECNOLOGIA", "Tecnologia"],
] as const;

function Nota({ name, label }: { name: string; label: string }) {
  return (
    <fieldset className="mt-3">
      <legend className="text-sm font-semibold">{label}</legend>
      <div className="mt-1 grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="block">
            <input type="radio" name={name} value={n} className="peer sr-only" />
            <span className="flex min-h-11 cursor-pointer items-center justify-center rounded-control border border-border bg-bg font-display text-lg font-bold peer-checked:border-brand peer-checked:bg-brand peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand">
              {n}
            </span>
          </label>
        ))}
      </div>
      <p className="mt-1 flex justify-between text-xs text-ink-muted">
        <span>1 = fraco</span>
        <span>5 = excelente</span>
      </p>
    </fieldset>
  );
}

export function VotoForm({ docentes }: { docentes: Docente[] }) {
  const [passo, setPasso] = useState<2 | 3>(2);
  const [aviso, setAviso] = useState<string | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<VotoState, FormData>(submeterVotoAction, {});
  const hidratado = useHidratado();
  const [, startTransition] = useTransition();
  // Envio por onSubmit: o React não limpa os campos depois de um erro (o utilizador não perde o que escreveu).
  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    startTransition(() => action(dados));
  }

  function continuar() {
    const f = form.current;
    if (!f) return;
    for (const d of docentes) {
      for (const c of CRITERIOS) {
        if (!f.querySelector(`input[name="n_${d.id}_${c.id}"]:checked`)) {
          setAviso(`Falta avaliar "${c.label}" em ${d.disciplina}.`);
          f.querySelector<HTMLInputElement>(`input[name="n_${d.id}_${c.id}"]`)?.focus();
          return;
        }
      }
    }
    setAviso(null);
    setPasso(3);
    window.scrollTo({ top: 0 });
  }

  return (
    <form ref={form} onSubmit={enviar} noValidate>
      <header className="mb-4">
        <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-border" aria-hidden="true">
          <div className={`h-full bg-brand transition-all ${passo === 2 ? "w-2/3" : "w-full"}`} />
        </div>
        <p className="text-sm font-semibold text-ink-muted">Passo {passo} de 3</p>
        <h1 className="font-display text-2xl font-bold">{passo === 2 ? "Avalia os teus docentes" : "Quase a acabar"}</h1>
        <p className="mt-2 rounded-control bg-ok-bg px-3 py-2 text-sm font-semibold text-ok">✔ Voto 100% anónimo</p>
      </header>

      <div hidden={passo !== 2} className="flex flex-col gap-4">
        {docentes.map((d) => (
          <section key={d.id} className="rounded-card border border-border bg-surface p-4">
            <h2 className="font-display text-lg font-bold">{d.disciplina}</h2>
            <p className="text-sm text-ink-muted">{d.nome}</p>
            {CRITERIOS.map((c) => (
              <Nota key={c.id} name={`n_${d.id}_${c.id}`} label={c.label} />
            ))}
            <details className="mt-3">
              <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-brand">
                Comentário opcional
              </summary>
              <textarea
                name={`c_${d.id}`}
                maxLength={400}
                rows={3}
                placeholder="Sem nomes de colegas nem dados pessoais."
                className="mt-1 w-full rounded-control border border-border bg-bg p-3 text-base"
              />
            </details>
          </section>
        ))}
        {aviso && (
          <p role="alert" className="rounded-control bg-crit-bg px-3 py-2 text-sm font-semibold text-crit">
            {aviso}
          </p>
        )}
        <button
          type="button"
          onClick={continuar}
          className="min-h-12 rounded-control bg-accent px-4 text-lg font-semibold text-white"
        >
          Continuar
        </button>
      </div>

      <div hidden={passo !== 3} className="flex flex-col gap-4">
        <section className="rounded-card border border-border bg-surface p-4">
          <label htmlFor="inquietacao" className="font-display text-lg font-bold">
            Qual é o maior problema da universidade que gostarias de ver resolvido?
          </label>
          <p className="text-sm text-ink-muted">Opcional. Não escrevas nomes de pessoas.</p>
          <select
            name="categoria"
            defaultValue=""
            aria-label="Categoria"
            className="mt-3 min-h-11 w-full rounded-control border border-border bg-bg px-3 text-base"
          >
            <option value="">Categoria…</option>
            {CATEGORIAS.map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
          <textarea
            id="inquietacao"
            name="inquietacao"
            maxLength={400}
            rows={4}
            className="mt-2 w-full rounded-control border border-border bg-bg p-3 text-base"
          />
        </section>

        {state.erro && (
          <p role="alert" className="rounded-control bg-crit-bg px-3 py-2 text-sm font-semibold text-crit">
            {state.erro}
          </p>
        )}
        <button
          disabled={pending || !hidratado}
          className="min-h-12 rounded-control bg-accent px-4 text-lg font-semibold text-white disabled:opacity-60"
        >
          {pending ? "A enviar…" : "Submeter Avaliação Anónima"}
        </button>
        <button
          type="button"
          onClick={() => setPasso(2)}
          className="min-h-11 rounded-control border border-border px-4 font-semibold"
        >
          Voltar
        </button>
      </div>
    </form>
  );
}
