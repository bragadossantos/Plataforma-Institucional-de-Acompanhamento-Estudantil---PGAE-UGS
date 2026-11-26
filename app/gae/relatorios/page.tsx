import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { requireAuth } from "@/lib/auth";
import { ciclosDisponiveis } from "@/lib/bi-core";
import { AVISO_AMOSTRA, CLASSE_LABEL } from "@/lib/bi-metrics";
import { getSql } from "@/lib/db";
import { GAE_ROLES } from "@/lib/rbac";
import { montarRelatorio } from "@/lib/relatorio";

export const metadata: Metadata = { title: "Relatórios · PGAE" };

type Params = { ciclo?: string; faculdade?: string; curso?: string; turma?: string };
const num = (v?: string) => (v && /^\d+$/.test(v) ? Number(v) : null);
const fmt = (n: number | null) => (n === null ? "—" : n.toFixed(2).replace(".", ","));

export default async function RelatoriosPage({ searchParams }: { searchParams: Promise<Params> }) {
  const user = await requireAuth(GAE_ROLES);
  const q = await searchParams;
  const sql = getSql();

  const ciclos = await ciclosDisponiveis(sql);
  const cicloId = num(q.ciclo) ?? ciclos[0]?.id ?? null;
  const [faculdades, cursos, turmas] = await Promise.all([
    sql`SELECT id, sigla FROM faculdades ORDER BY sigla`,
    sql`SELECT id, codigo FROM cursos ORDER BY codigo`,
    sql`SELECT t.id, c.codigo || t.ano_curricular || t.designacao AS nome, t.semestre_letivo
        FROM turmas t JOIN cursos c ON c.id = t.curso_id ORDER BY t.semestre_letivo DESC, nome`,
  ]);

  const filtros = { cicloId: cicloId ?? 0, faculdadeId: num(q.faculdade), cursoId: num(q.curso), turmaId: num(q.turma) };
  const rel = cicloId === null ? null : await montarRelatorio(sql, filtros);

  const qs = new URLSearchParams();
  if (cicloId !== null) qs.set("ciclo", String(cicloId));
  for (const k of ["faculdade", "curso", "turma"] as const) if (num(q[k])) qs.set(k, String(num(q[k])));

  return (
    <AppShell user={user} current="/gae/relatorios" title="Relatórios para a Direção">
      {!rel || cicloId === null ? (
        <p className="max-w-prose text-ink-muted">Ainda não há ciclos abertos ou encerrados para gerar relatórios.</p>
      ) : (
        <>
          <form method="get" className="mb-6 flex flex-wrap items-end gap-3 rounded-card border border-border bg-surface p-4">
            <Sel nome="ciclo" label="Ciclo" valor={String(cicloId)} opcoes={ciclos.map((c) => [String(c.id), c.titulo])} semTodos />
            <Sel nome="faculdade" label="Faculdade" valor={q.faculdade} opcoes={faculdades.map((f) => [String(f.id), f.sigla])} />
            <Sel nome="curso" label="Curso" valor={q.curso} opcoes={cursos.map((c) => [String(c.id), c.codigo])} />
            <Sel nome="turma" label="Turma" valor={q.turma} opcoes={turmas.map((t) => [String(t.id), `${t.nome} · ${t.semestre_letivo}`])} />
            <button className="min-h-11 rounded-control bg-brand px-4 font-semibold text-white">Pré-visualizar</button>
          </form>

          <div className="mb-6 flex flex-wrap gap-3">
            <a
              href={`/api/export/pdf?${qs}`}
              className="flex min-h-11 items-center rounded-control bg-accent px-4 font-semibold text-white"
            >
              Exportar Relatório para a Direção (PDF)
            </a>
            <a
              href={`/api/export/csv?${qs}`}
              className="flex min-h-11 items-center rounded-control border border-border bg-surface px-4 font-semibold"
            >
              Exportar CSV
            </a>
          </div>
          <p className="mb-4 text-xs text-ink-muted">Cada exportação fica registada na trilha de auditoria.</p>

          <section className="rounded-card border border-border bg-surface p-4">
            <h2 className="font-display text-xl font-bold">{rel.ciclo.titulo}</h2>
            <p className="text-sm text-ink-muted">
              {rel.ciclo.semestre} · {rel.ciclo.inicio} a {rel.ciclo.fim} · {rel.filtros}
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Item rot="Taxa de adesão" val={`${rel.kpis.adesaoGlobal.toFixed(0)} %`} />
              <Item rot="Média pedagógica" val={fmt(rel.kpis.mediaPedagogica)} />
              <Item rot="Docentes em destaque" val={String(rel.kpis.docentesDestaque)} />
              <Item rot="Alertas críticos" val={String(rel.kpis.alertasCriticosAbertos)} />
            </dl>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border text-xs uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th className="py-2 pr-4">Docente</th>
                    <th className="py-2 pr-4">Turma</th>
                    <th className="py-2 pr-4 text-right">Votos</th>
                    <th className="py-2 pr-4 text-right">IDD</th>
                    <th className="py-2">Classificação</th>
                  </tr>
                </thead>
                <tbody>
                  {rel.ranking.map((l) => (
                    <tr key={l.turmaDocenteId} className="border-b border-border last:border-0">
                      <td className="py-2 pr-4">
                        <span className="font-semibold">{l.docente}</span>
                        <span className="block text-xs text-ink-muted">{l.disciplina}</span>
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs font-medium">{l.turma}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{l.votos}</td>
                      <td className="py-2 pr-4 text-right font-semibold tabular-nums">{fmt(l.idd)}</td>
                      <td className="py-2">{l.visivel && l.classe ? CLASSE_LABEL[l.classe] : AVISO_AMOSTRA}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rel.ranking.length === 0 && <p className="py-4 text-ink-muted">Ainda não há votos neste ciclo e filtro.</p>}
            </div>
          </section>
        </>
      )}
      <p className="mt-4 text-sm">
        <Link href="/gae" className="font-semibold text-brand underline">
          Voltar ao painel
        </Link>
      </p>
    </AppShell>
  );
}

function Item({ rot, val }: { rot: string; val: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{rot}</dt>
      <dd className="font-display text-3xl font-bold">{val}</dd>
    </div>
  );
}

function Sel({ nome, label, valor, opcoes, semTodos }: { nome: string; label: string; valor?: string; opcoes: [string, string][]; semTodos?: boolean }) {
  return (
    <div>
      <label htmlFor={`r-${nome}`} className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {label}
      </label>
      <select id={`r-${nome}`} name={nome} defaultValue={valor ?? ""} className="mt-1 block min-h-11 rounded-control border border-border bg-bg px-3 text-sm">
        {!semTodos && <option value="">Todos</option>}
        {opcoes.map(([v, t]) => (
          <option key={v} value={v}>
            {t}
          </option>
        ))}
      </select>
    </div>
  );
}
