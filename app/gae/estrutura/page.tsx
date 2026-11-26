import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Campo, Selecao, Selo } from "@/components/campos";
import { FormAcao } from "@/components/form-acao";
import { requireAuth } from "@/lib/auth";
import { getSql } from "@/lib/db";
import {
  alternarAssociacaoAction,
  alternarCursoAction,
  alternarDocenteAction,
  alternarFaculdadeAction,
  associarDocenteAction,
  criarCursoAction,
  criarDocenteAction,
  criarFaculdadeAction,
  criarTurmaAction,
} from "./actions";

export const metadata: Metadata = { title: "Estrutura académica · PGAE" };

const ABAS = [
  { id: "faculdades", label: "Faculdades" },
  { id: "cursos", label: "Cursos" },
  { id: "turmas", label: "Turmas" },
  { id: "docentes", label: "Docentes" },
] as const;
type Aba = (typeof ABAS)[number]["id"];

const PERIODO: Record<string, string> = { MANHA: "Manhã", TARDE: "Tarde", NOITE: "Noite" };

function Alternar({ action, id, ativo }: { action: (f: FormData) => Promise<void>; id: number; ativo: boolean }) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button className="min-h-11 rounded-control border border-border px-3 text-sm font-semibold hover:bg-bg">
        {ativo ? "Desativar" : "Ativar"}
      </button>
    </form>
  );
}

function Tabela({ cabecalho, children, vazio }: { cabecalho: string[]; children: React.ReactNode; vazio: string }) {
  const linhas = Array.isArray(children) ? children.length : children ? 1 : 0;
  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border text-xs uppercase tracking-wide text-ink-muted">
          <tr>
            {cabecalho.map((c) => (
              <th key={c} className="px-4 py-3">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {linhas === 0 && <p className="px-4 py-6 text-ink-muted">{vazio}</p>}
    </div>
  );
}

function Cartao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 rounded-card border border-border bg-surface p-4">
      <h2 className="mb-3 font-display text-lg font-bold">{titulo}</h2>
      {children}
    </section>
  );
}

const td = "px-4 py-2";

export default async function EstruturaPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const user = await requireAuth(["GAE_ADMIN"]);
  const { aba: q } = await searchParams;
  const aba: Aba = ABAS.some((a) => a.id === q) ? (q as Aba) : "faculdades";

  return (
    <AppShell user={user} current="/gae/estrutura" title="Estrutura académica">
      <nav aria-label="Secções" className="mb-6 flex gap-2 overflow-x-auto">
        {ABAS.map((a) => (
          <Link
            key={a.id}
            href={`/gae/estrutura?aba=${a.id}`}
            aria-current={a.id === aba ? "page" : undefined}
            className={`flex min-h-11 shrink-0 items-center rounded-control px-4 text-sm font-semibold ${
              a.id === aba ? "bg-brand text-white" : "border border-border bg-surface"
            }`}
          >
            {a.label}
          </Link>
        ))}
      </nav>

      {aba === "faculdades" && <Faculdades />}
      {aba === "cursos" && <Cursos />}
      {aba === "turmas" && <Turmas />}
      {aba === "docentes" && <Docentes />}
    </AppShell>
  );

}

async function Faculdades() {
  const sql = getSql();
  const rows = await sql`SELECT id, nome, sigla, ativa FROM faculdades ORDER BY nome`;
  return (
    <>
      <Cartao titulo="Nova faculdade">
        <FormAcao action={criarFaculdadeAction} submit="Criar faculdade">
          <Campo label="Nome" name="nome" />
          <Campo label="Sigla" name="sigla" placeholder="FENT" />
        </FormAcao>
      </Cartao>
      <Tabela cabecalho={["Nome", "Sigla", "Estado", ""]} vazio="Ainda não há faculdades.">
        {rows.map((f) => (
          <tr key={f.id} className="border-b border-border last:border-0">
            <td className={td}>{f.nome}</td>
            <td className={`${td} font-mono text-xs font-medium`}>{f.sigla}</td>
            <td className={td}><Selo ativo={f.ativa} /></td>
            <td className={td}><Alternar action={alternarFaculdadeAction} id={f.id} ativo={f.ativa} /></td>
          </tr>
        ))}
      </Tabela>
    </>
  );
}

async function Cursos() {
  const sql = getSql();
  const facs = await sql`SELECT id, sigla FROM faculdades WHERE ativa ORDER BY sigla`;
  const rows = await sql`
    SELECT c.id, c.nome, c.codigo, c.ativo, f.sigla
    FROM cursos c JOIN faculdades f ON f.id = c.faculdade_id ORDER BY f.sigla, c.nome`;
  return (
    <>
      <Cartao titulo="Novo curso">
        <FormAcao action={criarCursoAction} submit="Criar curso">
          <Selecao label="Faculdade" name="faculdadeId" opcoes={facs.map((f) => ({ valor: f.id, texto: f.sigla }))} />
          <Campo label="Nome" name="nome" />
          <Campo label="Código" name="codigo" placeholder="EI" />
        </FormAcao>
      </Cartao>
      <Tabela cabecalho={["Faculdade", "Curso", "Código", "Estado", ""]} vazio="Ainda não há cursos.">
        {rows.map((c) => (
          <tr key={c.id} className="border-b border-border last:border-0">
            <td className={td}>{c.sigla}</td>
            <td className={td}>{c.nome}</td>
            <td className={`${td} font-mono text-xs font-medium`}>{c.codigo}</td>
            <td className={td}><Selo ativo={c.ativo} /></td>
            <td className={td}><Alternar action={alternarCursoAction} id={c.id} ativo={c.ativo} /></td>
          </tr>
        ))}
      </Tabela>
    </>
  );
}

async function Docentes() {
  const sql = getSql();
  const rows = await sql`SELECT id, nome_completo, codigo_docente, grau_academico, ativo FROM docentes ORDER BY nome_completo`;
  return (
    <>
      <Cartao titulo="Novo docente">
        <FormAcao action={criarDocenteAction} submit="Criar docente">
          <Campo label="Nome completo" name="nome" />
          <Campo label="Código (opcional)" name="codigo" required={false} />
          <Campo label="Grau académico (opcional)" name="grau" required={false} placeholder="Mestre" />
        </FormAcao>
      </Cartao>
      <Tabela cabecalho={["Nome", "Código", "Grau", "Estado", ""]} vazio="Ainda não há docentes.">
        {rows.map((d) => (
          <tr key={d.id} className="border-b border-border last:border-0">
            <td className={td}>{d.nome_completo}</td>
            <td className={`${td} font-mono text-xs font-medium`}>{d.codigo_docente ?? "—"}</td>
            <td className={td}>{d.grau_academico ?? "—"}</td>
            <td className={td}><Selo ativo={d.ativo} /></td>
            <td className={td}><Alternar action={alternarDocenteAction} id={d.id} ativo={d.ativo} /></td>
          </tr>
        ))}
      </Tabela>
    </>
  );
}

async function Turmas() {
  const sql = getSql();
  const cursos = await sql`
    SELECT c.id, c.codigo, c.nome FROM cursos c JOIN faculdades f ON f.id = c.faculdade_id
    WHERE c.ativo AND f.ativa ORDER BY c.codigo`;
  const docentes = await sql`SELECT id, nome_completo FROM docentes WHERE ativo ORDER BY nome_completo`;
  const turmas = await sql`
    SELECT t.id, t.ano_curricular, t.designacao, t.periodo, t.semestre_letivo, t.codigo_acesso,
           t.total_estimado_alunos, c.codigo AS curso
    FROM turmas t JOIN cursos c ON c.id = t.curso_id
    ORDER BY t.semestre_letivo DESC, c.codigo, t.ano_curricular, t.designacao`;
  const assoc = await sql`
    SELECT td.id, td.turma_id, td.disciplina, td.ativo, d.nome_completo
    FROM turma_docentes td JOIN docentes d ON d.id = td.docente_id ORDER BY td.disciplina`;

  return (
    <>
      <Cartao titulo="Nova turma (máx. 4 por curso, ano e semestre)">
        <FormAcao action={criarTurmaAction} submit="Criar turma">
          <Selecao label="Curso" name="cursoId" opcoes={cursos.map((c) => ({ valor: c.id, texto: `${c.codigo} · ${c.nome}` }))} />
          <Selecao label="Ano" name="ano" opcoes={[1, 2, 3, 4, 5].map((n) => ({ valor: n, texto: `${n}.º ano` }))} />
          <Selecao label="Turma" name="designacao" opcoes={["A", "B", "C", "D"].map((l) => ({ valor: l, texto: l }))} />
          <Selecao label="Período" name="periodo" opcoes={Object.entries(PERIODO).map(([v, t]) => ({ valor: v, texto: t }))} />
          <Campo label="Semestre" name="semestre" defaultValue="2026-S2" />
          <Campo label="Alunos estimados" name="totalEstimado" type="number" inputMode="numeric" defaultValue={40} />
        </FormAcao>
      </Cartao>

      <Cartao titulo="Associar docente a uma turma">
        <FormAcao action={associarDocenteAction} submit="Associar docente">
          <Selecao
            label="Turma"
            name="turmaId"
            opcoes={turmas.map((t) => ({ valor: t.id, texto: `${t.curso}${t.ano_curricular}${t.designacao} · ${t.semestre_letivo}` }))}
          />
          <Selecao label="Docente" name="docenteId" opcoes={docentes.map((d) => ({ valor: d.id, texto: d.nome_completo }))} />
          <Campo label="Disciplina" name="disciplina" />
        </FormAcao>
      </Cartao>

      <Tabela cabecalho={["Turma", "Semestre", "Período", "Alunos", "Código de acesso", "Docentes e disciplinas"]} vazio="Ainda não há turmas.">
        {turmas.map((t) => (
          <tr key={t.id} className="border-b border-border align-top last:border-0">
            <td className={`${td} font-semibold`}>{t.curso}{t.ano_curricular}{t.designacao}</td>
            <td className={td}>{t.semestre_letivo}</td>
            <td className={td}>{PERIODO[t.periodo]}</td>
            <td className={`${td} tabular-nums`}>{t.total_estimado_alunos}</td>
            <td className={td}>
              <span className="rounded-full border border-border bg-bg px-3 py-1 font-mono text-xs font-medium">{t.codigo_acesso}</span>
            </td>
            <td className={td}>
              {assoc.filter((a) => a.turma_id === t.id).length === 0 && <span className="text-ink-muted">Sem docentes</span>}
              <ul className="flex flex-col gap-1">
                {assoc.filter((a) => a.turma_id === t.id).map((a) => (
                  <li key={a.id} className="flex items-center gap-2">
                    <span className={a.ativo ? "" : "text-ink-muted line-through"}>
                      {a.disciplina} — {a.nome_completo}
                    </span>
                    <Alternar action={alternarAssociacaoAction} id={a.id} ativo={a.ativo} />
                  </li>
                ))}
              </ul>
            </td>
          </tr>
        ))}
      </Tabela>
    </>
  );
}
