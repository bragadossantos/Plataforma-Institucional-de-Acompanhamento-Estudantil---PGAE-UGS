import type { Metadata } from "next";
import Link from "next/link";
import { AcaoLinha } from "@/components/acao-linha";
import { AppShell } from "@/components/app-shell";
import { FormAcao } from "@/components/form-acao";
import { requireAuth } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { GAE_ROLES } from "@/lib/rbac";
import { ESTADO_LABEL, transicoesPermitidas, type Estado } from "@/lib/triagem-core";
import { alterarEstadoAction, definirFentAction, definirInquietacaoAction } from "./actions";

export const metadata: Metadata = { title: "Auditorias · PGAE" };

const GRAV: Record<string, string> = {
  BAIXA: "bg-ok-bg text-ok",
  MEDIA: "bg-warn-bg text-warn",
  ALTA: "bg-warn-bg text-warn",
  CRITICA: "bg-crit-bg text-crit",
};
const GRAV_LABEL: Record<string, string> = { BAIXA: "Baixa", MEDIA: "Média", ALTA: "Alta", CRITICA: "Crítica" };
const ABAS = [
  { id: "abertas", label: "Abertas" },
  { id: "encerradas", label: "Encerradas" },
  { id: "inquietacoes", label: "Inquietações dos estudantes" },
] as const;
type Aba = (typeof ABAS)[number]["id"];
const campo = "mt-1 min-h-11 w-full rounded-control border border-border bg-surface px-3 text-base";
const fmt = (d: Date) => new Date(d).toLocaleDateString("pt-AO", { timeZone: "Africa/Luanda" });

export default async function AuditoriasPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const user = await requireAuth(GAE_ROLES);
  const { aba: q } = await searchParams;
  const aba: Aba = ABAS.some((a) => a.id === q) ? (q as Aba) : "abertas";

  return (
    <AppShell user={user} current="/gae/auditorias" title="Ocorrências e triagem">
      <nav aria-label="Secções" className="mb-6 flex gap-2 overflow-x-auto">
        {ABAS.map((a) => (
          <Link
            key={a.id}
            href={`/gae/auditorias?aba=${a.id}`}
            aria-current={a.id === aba ? "page" : undefined}
            className={`flex min-h-11 shrink-0 items-center rounded-control px-4 text-sm font-semibold ${
              a.id === aba ? "bg-brand text-white" : "border border-border bg-surface"
            }`}
          >
            {a.label}
          </Link>
        ))}
      </nav>
      {aba === "inquietacoes" ? <Inquietacoes /> : <Ocorrencias abertas={aba === "abertas"} />}
    </AppShell>
  );
}

async function Ocorrencias({ abertas }: { abertas: boolean }) {
  const sql = getSql();
  const rows = abertas
    ? await sql`
        SELECT a.*, c.codigo AS curso, t.ano_curricular, t.designacao, td.disciplina, u.nome_completo AS autor
        FROM auditorias_sala a JOIN turmas t ON t.id = a.turma_id JOIN cursos c ON c.id = t.curso_id
        JOIN utilizadores u ON u.id = a.autor_id LEFT JOIN turma_docentes td ON td.id = a.turma_docente_id
        WHERE a.estado IN ('NOVO', 'EM_ANALISE', 'ENCAMINHADO_DIRECAO')
        ORDER BY (a.gravidade = 'CRITICA') DESC, a.id DESC LIMIT 100`
    : await sql`
        SELECT a.*, c.codigo AS curso, t.ano_curricular, t.designacao, td.disciplina, u.nome_completo AS autor
        FROM auditorias_sala a JOIN turmas t ON t.id = a.turma_id JOIN cursos c ON c.id = t.curso_id
        JOIN utilizadores u ON u.id = a.autor_id LEFT JOIN turma_docentes td ON td.id = a.turma_docente_id
        WHERE a.estado IN ('RESOLVIDO', 'ARQUIVADO') ORDER BY a.atualizado_em DESC LIMIT 100`;

  if (rows.length === 0) return <p className="text-ink-muted">Sem ocorrências nesta lista.</p>;

  return (
    <ul className="flex flex-col gap-4">
      {rows.map((r) => {
        const seguintes = transicoesPermitidas(r.estado as Estado);
        return (
          <li key={r.id} className="rounded-card border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${GRAV[r.gravidade]}`}>
                {GRAV_LABEL[r.gravidade]}
              </span>
              <span className="rounded-full bg-border px-2.5 py-0.5 text-xs font-semibold">{ESTADO_LABEL[r.estado as Estado]}</span>
              {r.elegivel_fentfest && (
                <span className="rounded-full bg-brand px-2.5 py-0.5 text-xs font-semibold text-white">No Banco de Desafios</span>
              )}
              <span className="font-mono text-xs font-medium">
                {r.curso}
                {r.ano_curricular}
                {r.designacao}
              </span>
              <span className="text-xs text-ink-muted">
                {r.categoria}
                {r.disciplina ? ` · ${r.disciplina}` : ""} · {fmt(r.criado_em)} · {r.autor}
              </span>
            </div>
            <h2 className="mt-2 font-display text-lg font-bold">{r.titulo}</h2>
            <p className="mt-1 max-w-prose whitespace-pre-line">{r.descricao_factual}</p>
            {r.parecer_gae && (
              <p className="mt-2 max-w-prose rounded-control bg-bg p-3 text-sm">
                <span className="font-semibold">Parecer do GAE: </span>
                {r.parecer_gae}
              </p>
            )}

            {seguintes.length > 0 && (
              <div className="mt-4 border-t border-border pt-4">
                <h3 className="mb-2 text-sm font-semibold">Atualizar estado</h3>
                <FormAcao action={alterarEstadoAction} submit="Guardar estado">
                  <input type="hidden" name="id" value={r.id} />
                  <div>
                    <label htmlFor={`estado-${r.id}`} className="text-sm font-semibold">
                      Novo estado
                    </label>
                    <select id={`estado-${r.id}`} name="estado" required defaultValue="" className={campo}>
                      <option value="" disabled>
                        Selecione…
                      </option>
                      {seguintes.map((e) => (
                        <option key={e} value={e}>
                          {ESTADO_LABEL[e]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor={`parecer-${r.id}`} className="text-sm font-semibold">
                      Parecer (opcional)
                    </label>
                    <input id={`parecer-${r.id}`} name="parecer" maxLength={2000} autoComplete="off" className={campo} />
                  </div>
                </FormAcao>
              </div>
            )}

            <div className="mt-4 border-t border-border pt-4">
              <h3 className="text-sm font-semibold">Banco de Desafios FENT Fest</h3>
              <p className="mb-2 text-xs text-ink-muted">
                Resumo impessoal, sem nomes de docentes, alunos ou de quem registou. É só isto que o Observador vê.
              </p>
              <FormAcao action={definirFentAction} submit="Guardar">
                <input type="hidden" name="id" value={r.id} />
                <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
                  <input type="checkbox" name="ativo" defaultChecked={r.elegivel_fentfest} className="size-5" />
                  Enviar problema anonimizado para o Banco de Desafios
                </label>
                <div className="sm:col-span-2">
                  <label htmlFor={`resumo-${r.id}`} className="text-sm font-semibold">
                    Resumo impessoal
                  </label>
                  <input
                    id={`resumo-${r.id}`}
                    name="resumo"
                    maxLength={300}
                    defaultValue={r.resumo_anonimizado_fentfest ?? ""}
                    placeholder="Dificuldade na consulta de horários atualizados das salas de laboratório"
                    autoComplete="off"
                    className={campo}
                  />
                </div>
              </FormAcao>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

async function Inquietacoes() {
  const sql = getSql();
  const rows = await sql`
    SELECT i.id, i.categoria, i.descricao, i.visivel_fentfest, i.data_registo, c.codigo AS curso, t.ano_curricular, t.designacao
    FROM inquietacoes_estudantis i JOIN turmas t ON t.id = i.turma_id JOIN cursos c ON c.id = t.curso_id
    ORDER BY i.visivel_fentfest ASC, i.id DESC LIMIT 200`;

  return (
    <>
      <p className="mb-4 max-w-prose text-sm text-ink-muted">
        Textos escritos livremente pelos estudantes. Leia antes de aprovar: só o que não identifica pessoas deve seguir
        para o Banco de Desafios.
      </p>
      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-4 py-3">Categoria</th>
              <th className="px-4 py-3">Inquietação</th>
              <th className="px-4 py-3">Turma</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Ação</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => (
              <tr key={i.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2 align-top text-xs font-semibold">{i.categoria}</td>
                <td className="max-w-md px-4 py-2 align-top">{i.descricao}</td>
                <td className="px-4 py-2 align-top font-mono text-xs font-medium">
                  {i.curso}
                  {i.ano_curricular}
                  {i.designacao}
                </td>
                <td className="px-4 py-2 align-top">{i.visivel_fentfest ? "Aprovada" : "Por rever"}</td>
                <td className="px-4 py-2 align-top">
                  <AcaoLinha
                    action={definirInquietacaoAction}
                    id={i.id}
                    label={i.visivel_fentfest ? "Retirar" : "Aprovar"}
                    extra={{ visivel: i.visivel_fentfest ? "0" : "1" }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="px-4 py-6 text-ink-muted">Ainda não há inquietações.</p>}
      </div>
    </>
  );
}
