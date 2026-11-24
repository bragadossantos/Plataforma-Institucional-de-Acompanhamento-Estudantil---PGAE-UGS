import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { requireAuth } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { bancoDeDesafios } from "@/lib/insights-core";
import { INSIGHTS_ROLES } from "@/lib/rbac";

export const metadata: Metadata = { title: "Desafios · PGAE" };

export default async function InsightsPage() {
  const user = await requireAuth(INSIGHTS_ROLES);
  const grupos = await bancoDeDesafios(getSql());
  const total = grupos.reduce((s, g) => s + g.total, 0);
  const max = Math.max(1, ...grupos.map((g) => g.total));

  return (
    <AppShell user={user} current="/insights" title="Banco de Desafios">
      <p className="mb-6 max-w-prose rounded-card border border-border bg-surface p-4 text-sm" role="note">
        <span className="font-semibold">Dados anonimizados e aprovados pelo GAE.</span> Aqui só aparecem problemas e
        inquietações sem nomes de pessoas, escolhidos pelo GAE como pontos de partida para desafios.
      </p>

      {grupos.length === 0 ? (
        <p className="text-ink-muted">Ainda não há problemas aprovados pelo GAE.</p>
      ) : (
        <>
          <section aria-label="Ranking por categoria" className="mb-8">
            <h2 className="mb-3 font-display text-lg font-bold">Onde dói mais · {total} problemas aprovados</h2>
            <ol className="flex flex-col gap-2">
              {grupos.map((g) => (
                <li key={g.tema} className="rounded-card border border-border bg-surface p-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold">{g.label}</span>
                    <span className="font-display text-xl font-bold tabular-nums">{g.total}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-border" aria-hidden="true">
                    <div className="h-full bg-brand" style={{ width: `${(g.total / max) * 100}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">
                    {g.estudantes} de estudantes · {g.gae} do GAE
                  </p>
                </li>
              ))}
            </ol>
          </section>

          {grupos.map((g) => (
            <section key={g.tema} className="mb-6">
              <h2 className="mb-2 font-display text-lg font-bold">{g.label}</h2>
              <ul className="flex flex-col gap-2">
                {g.itens.map((i, idx) => (
                  <li key={idx} className="rounded-card border border-border bg-surface p-3 text-sm">
                    <span
                      className={`mr-2 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                        i.origem === "ESTUDANTES" ? "bg-warn-bg text-warn" : "bg-ok-bg text-ok"
                      }`}
                    >
                      {i.origem === "ESTUDANTES" ? "Estudantes" : "GAE"}
                    </span>
                    {i.texto}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </AppShell>
  );
}
