import type { Metadata } from "next";
import { AcaoLinha } from "@/components/acao-linha";
import { AppShell } from "@/components/app-shell";
import { Campo } from "@/components/campos";
import { FormAcao } from "@/components/form-acao";
import { requireAuth } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { GAE_ROLES } from "@/lib/rbac";
import {
  abrirCicloAction,
  alternarCodigoAction,
  criarCicloAction,
  encerrarCicloAction,
  rodarCodigoAction,
} from "./actions";

export const metadata: Metadata = { title: "Ciclos · PGAE" };

const ESTADO: Record<string, { texto: string; cls: string }> = {
  RASCUNHO: { texto: "Rascunho", cls: "bg-border text-ink-muted" },
  ATIVO: { texto: "Ativo", cls: "bg-ok-bg text-ok" },
  ENCERRADO: { texto: "Encerrado", cls: "bg-warn-bg text-warn" },
};
const td = "px-4 py-2 align-top";
const fmt = (d: Date) => new Date(d).toLocaleDateString("pt-AO", { timeZone: "Africa/Luanda" });

export default async function CiclosPage() {
  const user = await requireAuth(GAE_ROLES);
  const sql = getSql();

  const ciclos = await sql`
    SELECT ci.id, ci.titulo, ci.semestre_letivo, ci.data_inicio, ci.data_fim, ci.estado,
           (SELECT COUNT(*)::int FROM votos_controlo vc WHERE vc.ciclo_id = ci.id) AS votos
    FROM ciclos_avaliacao ci ORDER BY ci.id DESC`;
  const turmas = await sql`
    SELECT t.id, c.codigo AS curso, t.ano_curricular, t.designacao, t.semestre_letivo, t.codigo_acesso, t.codigo_ativo
    FROM turmas t JOIN cursos c ON c.id = t.curso_id
    ORDER BY t.semestre_letivo DESC, c.codigo, t.ano_curricular, t.designacao`;

  return (
    <AppShell user={user} current="/gae/ciclos" title="Ciclos e códigos de turma">
      <section className="mb-6 rounded-card border border-border bg-surface p-4">
        <h2 className="mb-3 font-display text-lg font-bold">Novo ciclo de avaliação</h2>
        <FormAcao action={criarCicloAction} submit="Criar ciclo">
          <Campo label="Título" name="titulo" placeholder="Avaliação intermédia 2.º semestre 2026" />
          <Campo label="Semestre" name="semestre" defaultValue="2026-S2" />
          <Campo label="Início" name="inicio" type="date" />
          <Campo label="Fim" name="fim" type="date" />
        </FormAcao>
      </section>

      <h2 className="mb-3 font-display text-lg font-bold">Ciclos</h2>
      <div className="mb-8 overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-4 py-3">Ciclo</th>
              <th className="px-4 py-3">Período</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Registos de controlo</th>
              <th className="px-4 py-3">Ação</th>
            </tr>
          </thead>
          <tbody>
            {ciclos.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0">
                <td className={td}>
                  <p className="font-semibold">{c.titulo}</p>
                  <p className="font-mono text-xs text-ink-muted">{c.semestre_letivo}</p>
                </td>
                <td className={td}>
                  {fmt(c.data_inicio)} – {fmt(c.data_fim)}
                </td>
                <td className={td}>
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${ESTADO[c.estado].cls}`}>
                    {ESTADO[c.estado].texto}
                  </span>
                </td>
                <td className={`${td} text-right tabular-nums`}>{c.votos}</td>
                <td className={td}>
                  {c.estado === "RASCUNHO" && <AcaoLinha action={abrirCicloAction} id={c.id} label="Abrir votação" />}
                  {c.estado === "ATIVO" && <AcaoLinha action={encerrarCicloAction} id={c.id} label="Encerrar" />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {ciclos.length === 0 && <p className="px-4 py-6 text-ink-muted">Ainda não há ciclos.</p>}
      </div>

      <h2 className="mb-1 font-display text-lg font-bold">Códigos de acesso das turmas</h2>
      <p className="mb-3 text-sm text-ink-muted">
        Rodar o código invalida o anterior de imediato. Desativar impede qualquer voto com esse código.
      </p>
      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-4 py-3">Turma</th>
              <th className="px-4 py-3">Semestre</th>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {turmas.map((t) => (
              <tr key={t.id} className="border-b border-border last:border-0">
                <td className={`${td} font-semibold`}>
                  {t.curso}
                  {t.ano_curricular}
                  {t.designacao}
                </td>
                <td className={td}>{t.semestre_letivo}</td>
                <td className={td}>
                  <span
                    className={`rounded-full border border-border bg-bg px-3 py-1 font-mono text-xs font-medium ${
                      t.codigo_ativo ? "" : "text-ink-muted line-through"
                    }`}
                  >
                    {t.codigo_acesso}
                  </span>
                </td>
                <td className={td}>
                  <div className="flex flex-wrap gap-2">
                    <AcaoLinha action={rodarCodigoAction} id={t.id} label="Rodar código" />
                    <AcaoLinha action={alternarCodigoAction} id={t.id} label={t.codigo_ativo ? "Desativar" : "Ativar"} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {turmas.length === 0 && <p className="px-4 py-6 text-ink-muted">Crie turmas em Estrutura.</p>}
      </div>
    </AppShell>
  );
}
