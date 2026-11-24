import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { requireAuth } from "@/lib/auth";
import { alertasCriticosAbertos, calcularKpis, ciclosDisponiveis, rankingDocentes, type LinhaDocente } from "@/lib/bi-core";
import { AVISO_AMOSTRA, CLASSE_LABEL } from "@/lib/bi-metrics";
import { getSql } from "@/lib/db";
import { GAE_ROLES } from "@/lib/rbac";

export const metadata: Metadata = { title: "Painel GAE · PGAE" };

type Params = { ciclo?: string; faculdade?: string; curso?: string; turma?: string };
const num = (v?: string) => (v && /^\d+$/.test(v) ? Number(v) : null);
const fmt = (n: number | null, d = 2) => (n === null ? "—" : n.toFixed(d).replace(".", ","));
const CLASSE_COR = { DESTAQUE: "bg-ok-bg text-ok", ESTAVEL: "bg-warn-bg text-warn", ALERTA: "bg-crit-bg text-crit" } as const;

export default async function GaePage({ searchParams }: { searchParams: Promise<Params> }) {
  const user = await requireAuth(GAE_ROLES);
  const q = await searchParams;
  const sql = getSql();

  const ciclos = await ciclosDisponiveis(sql);
  const cicloId = num(q.ciclo) ?? ciclos[0]?.id ?? null;

  const [faculdades, cursos, turmas] = await Promise.all([
    sql`SELECT id, sigla FROM faculdades ORDER BY sigla`,
    sql`SELECT id, codigo, faculdade_id FROM cursos ORDER BY codigo`,
    sql`SELECT t.id, c.codigo || t.ano_curricular || t.designacao AS nome, t.semestre_letivo
        FROM turmas t JOIN cursos c ON c.id = t.curso_id ORDER BY t.semestre_letivo DESC, nome`,
  ]);

  if (cicloId === null) {
    return (
      <AppShell user={user} current="/gae" title="Painel GAE">
        <p className="max-w-prose text-ink-muted">
          Ainda não há ciclos abertos ou encerrados. Crie e abra um ciclo em{" "}
          <Link href="/gae/ciclos" className="font-semibold text-brand underline">
            Ciclos
          </Link>{" "}
          para começar a ver indicadores.
        </p>
      </AppShell>
    );
  }

  const filtros = { cicloId, faculdadeId: num(q.faculdade), cursoId: num(q.curso), turmaId: num(q.turma) };
  const ranking = await rankingDocentes(sql, filtros);
  const [kpis, alertas] = await Promise.all([calcularKpis(sql, filtros, ranking), alertasCriticosAbertos(sql, filtros)]);

  const qs = new URLSearchParams({ ciclo: String(cicloId) });
  for (const k of ["faculdade", "curso", "turma"] as const) if (num(q[k])) qs.set(k, String(num(q[k])));

  const destaque = ranking.filter((r) => r.classe === "DESTAQUE").slice(0, 5);
  const alertaPedagogico = ranking.filter((r) => r.classe === "ALERTA");

  return (
    <AppShell user={user} current="/gae" title="Painel GAE">
      <div className="mb-4 flex justify-end">
        <a
          href={`/api/export/pdf?${qs}`}
          className="flex min-h-11 items-center rounded-control bg-accent px-4 font-semibold text-white"
        >
          Exportar Relatório para a Direção (PDF)
        </a>
      </div>

      <section aria-label="Indicadores" className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Taxa de adesão global" valor={`${fmt(kpis.adesaoGlobal, 0)} %`} nota={`${kpis.votosUnicos} de ${kpis.alunosEstimados} alunos estimados`} />
        <Kpi label="Média pedagógica UGS" valor={fmt(kpis.mediaPedagogica)} nota="IDD ponderado, só grupos com ≥ 5 votos" />
        <Kpi label="Docentes em destaque" valor={String(kpis.docentesDestaque)} nota="IDD ≥ 4,20" />
        <Kpi
          label="Alertas críticos abertos"
          valor={String(kpis.alertasCriticosAbertos)}
          nota="Ocorrências críticas sem resolução"
          critico={kpis.alertasCriticosAbertos > 0}
        />
      </section>

      <form method="get" className="mb-6 flex flex-wrap items-end gap-3 rounded-card border border-border bg-surface p-4">
        <Filtro nome="ciclo" label="Ciclo" valor={String(cicloId)} opcoes={ciclos.map((c) => [String(c.id), `${c.titulo}${c.estado === "ATIVO" ? " (ativo)" : ""}`])} semTodos />
        <Filtro nome="faculdade" label="Faculdade" valor={q.faculdade} opcoes={faculdades.map((f) => [String(f.id), f.sigla])} />
        <Filtro nome="curso" label="Curso" valor={q.curso} opcoes={cursos.map((c) => [String(c.id), c.codigo])} />
        <Filtro nome="turma" label="Turma" valor={q.turma} opcoes={turmas.map((t) => [String(t.id), `${t.nome} · ${t.semestre_letivo}`])} />
        <button className="min-h-11 rounded-control bg-brand px-4 font-semibold text-white">Aplicar filtros</button>
        <Link href="/gae" className="flex min-h-11 items-center px-2 text-sm font-semibold text-brand underline">
          Limpar
        </Link>
      </form>

      <div className="mb-8 grid gap-6 xl:grid-cols-3">
        <section className="xl:col-span-2">
          <h2 className="mb-3 font-display text-lg font-bold">Docentes em destaque</h2>
          <Tabela linhas={destaque} vazio="Nenhum docente com IDD ≥ 4,20 e pelo menos 5 votos neste filtro." />
        </section>

        <section>
          <h2 className="mb-3 font-display text-lg font-bold">Alertas críticos</h2>
          <div className="rounded-card border border-border bg-surface">
            {alertas.length === 0 && alertaPedagogico.length === 0 && (
              <p className="p-4 text-sm text-ink-muted">Sem alertas abertos neste filtro.</p>
            )}
            <ul className="divide-y divide-border">
              {alertas.map((a) => (
                <li key={`o${a.id}`} className="p-3 text-sm">
                  <span className="mr-2 inline-flex rounded-full bg-crit-bg px-2 py-0.5 text-xs font-semibold text-crit">Ocorrência</span>
                  <span className="font-mono text-xs font-medium">{a.turma}</span>
                  <p className="font-semibold">{a.titulo}</p>
                </li>
              ))}
              {alertaPedagogico.map((r) => (
                <li key={`p${r.turmaDocenteId}`} className="p-3 text-sm">
                  <span className="mr-2 inline-flex rounded-full bg-crit-bg px-2 py-0.5 text-xs font-semibold text-crit">Alerta Pedagógico</span>
                  <span className="font-mono text-xs font-medium">{r.turma}</span>
                  <p className="font-semibold">
                    {r.disciplina} — IDD {fmt(r.idd)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      <h2 className="mb-3 font-display text-lg font-bold">Todos os docentes avaliados</h2>
      <Tabela linhas={ranking} vazio="Ainda não há votos neste ciclo e filtro." detalhe />
    </AppShell>
  );
}

function Kpi({ label, valor, nota, critico }: { label: string; valor: string; nota: string; critico?: boolean }) {
  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
      <p className={`mt-1 font-display text-4xl font-bold leading-none ${critico ? "text-crit" : ""}`}>{valor}</p>
      <p className="mt-2 text-sm text-ink-muted">{nota}</p>
    </div>
  );
}

function Filtro({
  nome,
  label,
  valor,
  opcoes,
  semTodos,
}: {
  nome: string;
  label: string;
  valor?: string;
  opcoes: [string, string][];
  semTodos?: boolean;
}) {
  return (
    <div>
      <label htmlFor={`f-${nome}`} className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {label}
      </label>
      <select
        id={`f-${nome}`}
        name={nome}
        defaultValue={valor ?? ""}
        className="mt-1 block min-h-11 rounded-control border border-border bg-bg px-3 text-sm"
      >
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

function Tabela({ linhas, vazio, detalhe }: { linhas: LinhaDocente[]; vazio: string; detalhe?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border text-xs uppercase tracking-wide text-ink-muted">
          <tr>
            <th className="px-4 py-3">Docente</th>
            <th className="px-4 py-3">Turma</th>
            <th className="px-4 py-3 text-right">Votos</th>
            <th className="px-4 py-3 text-right">IDD</th>
            {detalhe && (
              <>
                <th className="px-4 py-3 text-right">Did.</th>
                <th className="px-4 py-3 text-right">Aval.</th>
                <th className="px-4 py-3 text-right">Pont.</th>
                <th className="px-4 py-3 text-right">Com.</th>
              </>
            )}
            <th className="px-4 py-3">Classificação</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((r) => (
            <tr key={r.turmaDocenteId} className="border-b border-border last:border-0">
              <td className="px-4 py-2">
                <p className="font-semibold">{r.docente}</p>
                <p className="text-xs text-ink-muted">{r.disciplina}</p>
              </td>
              <td className="px-4 py-2 font-mono text-xs font-medium">{r.turma}</td>
              <td className="px-4 py-2 text-right tabular-nums">{r.votos}</td>
              <td className="px-4 py-2 text-right font-semibold tabular-nums">{fmt(r.idd)}</td>
              {detalhe && (
                <>
                  <td className="px-4 py-2 text-right tabular-nums">{fmt(r.didatica)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmt(r.avaliacao)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmt(r.pontualidade)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmt(r.comunicacao)}</td>
                </>
              )}
              <td className="px-4 py-2">
                {r.visivel && r.classe ? (
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${CLASSE_COR[r.classe]}`}>
                    {CLASSE_LABEL[r.classe]}
                  </span>
                ) : (
                  <span className="inline-block rounded-control border border-dashed border-ink-muted px-2 py-1 text-xs text-ink-muted">
                    {AVISO_AMOSTRA}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {linhas.length === 0 && <p className="px-4 py-6 text-ink-muted">{vazio}</p>}
    </div>
  );
}
