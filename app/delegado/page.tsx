import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { participacaoDaTurma } from "@/lib/auditoria-core";
import { requireAuth } from "@/lib/auth";
import { taxaParticipacao } from "@/lib/bi-metrics";
import { getSql } from "@/lib/db";
import { LIDERANCA_ROLES } from "@/lib/rbac";

export const metadata: Metadata = { title: "Painel da turma · PGAE" };

export default async function DelegadoPage() {
  const user = await requireAuth(LIDERANCA_ROLES);
  // Tudo é lido pela turma da sessão (leitura só da própria turma).
  const turmaId = user.turmaId;
  if (turmaId === null) {
    return (
      <AppShell user={user} current="/delegado" title="Painel da turma">
        <p className="text-ink-muted">A sua conta não tem turma associada. Contacte o GAE.</p>
      </AppShell>
    );
  }

  const sql = getSql();
  const [turma] = await sql`
    SELECT t.ano_curricular, t.designacao, t.semestre_letivo, t.codigo_acesso, t.codigo_ativo,
           t.total_estimado_alunos, c.codigo AS curso, c.nome AS curso_nome
    FROM turmas t JOIN cursos c ON c.id = t.curso_id WHERE t.id = ${turmaId}`;
  const ciclos = await participacaoDaTurma(sql, turmaId);
  const ativo = ciclos.find((c) => c.estado === "ATIVO");

  return (
    <AppShell user={user} current="/delegado" title={`Turma ${turma.curso}${turma.ano_curricular}${turma.designacao}`}>
      <p className="mb-6 text-ink-muted">
        {turma.curso_nome} · {turma.ano_curricular}.º ano · {turma.semestre_letivo}
      </p>

      <div className="mb-8 grid gap-4 md:grid-cols-2">
        <section className="rounded-card border border-border bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Código de acesso da turma</p>
          <p className="mt-2 font-mono text-3xl font-medium tracking-wider">{turma.codigo_acesso}</p>
          <p className="mt-2 text-sm text-ink-muted">
            {turma.codigo_ativo
              ? "Partilhe este código com os colegas para votarem em /votar. Só o GAE o pode alterar."
              : "Código desativado pelo GAE: de momento ninguém consegue votar."}
          </p>
        </section>

        <section className="rounded-card border border-border bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Taxa de adesão · ciclo ativo</p>
          {ativo ? (
            <Medidor votos={ativo.votos} total={turma.total_estimado_alunos} titulo={ativo.titulo} />
          ) : (
            <p className="mt-2 text-ink-muted">Não há nenhum ciclo de avaliação aberto para a sua turma.</p>
          )}
        </section>
      </div>

      <h2 className="mb-3 font-display text-lg font-bold">Histórico</h2>
      <div className="mb-8 overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-4 py-3">Ciclo</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Votos</th>
              <th className="px-4 py-3 text-right">Adesão</th>
            </tr>
          </thead>
          <tbody>
            {ciclos.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2">{c.titulo}</td>
                <td className="px-4 py-2">{c.estado === "ATIVO" ? "Ativo" : "Encerrado"}</td>
                <td className="px-4 py-2 text-right tabular-nums">{c.votos}</td>
                <td className="px-4 py-2 text-right font-semibold tabular-nums">
                  {taxaParticipacao(c.votos, turma.total_estimado_alunos).toFixed(0)} %
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {ciclos.length === 0 && <p className="px-4 py-6 text-ink-muted">Ainda não houve ciclos para esta turma.</p>}
      </div>

      <Link
        href="/delegado/auditoria"
        className="inline-flex min-h-11 items-center rounded-control bg-accent px-4 font-semibold text-white"
      >
        Registar ocorrência de sala
      </Link>
    </AppShell>
  );
}

function Medidor({ votos, total, titulo }: { votos: number; total: number; titulo: string }) {
  const pct = taxaParticipacao(votos, total);
  return (
    <div className="mt-2">
      <p className="font-display text-4xl font-bold leading-none">{pct.toFixed(0)} %</p>
      <div
        className="mt-3 h-3 overflow-hidden rounded-full bg-border"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Taxa de adesão da turma"
      >
        <div className="h-full bg-brand" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-sm text-ink-muted">
        {votos} de {total} alunos estimados · {titulo}
      </p>
    </div>
  );
}
