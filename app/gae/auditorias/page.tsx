import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { requireAuth } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { GAE_ROLES } from "@/lib/rbac";

export const metadata: Metadata = { title: "Auditorias · PGAE" };

const GRAV: Record<string, string> = {
  BAIXA: "bg-ok-bg text-ok",
  MEDIA: "bg-warn-bg text-warn",
  ALTA: "bg-warn-bg text-warn",
  CRITICA: "bg-crit-bg text-crit",
};
const GRAV_LABEL: Record<string, string> = { BAIXA: "Baixa", MEDIA: "Média", ALTA: "Alta", CRITICA: "Crítica" };
const ESTADO_LABEL: Record<string, string> = {
  NOVO: "Novo",
  EM_ANALISE: "Em análise",
  ENCAMINHADO_DIRECAO: "Encaminhado à Direção",
  RESOLVIDO: "Resolvido",
  ARQUIVADO: "Arquivado",
};
const td = "px-4 py-2 align-top";

export default async function AuditoriasPage() {
  const user = await requireAuth(GAE_ROLES);
  const rows = await listarOcorrencias();

  return (
    <AppShell user={user} current="/gae/auditorias" title="Ocorrências de sala de aula">
      <p className="mb-4 max-w-prose text-sm text-ink-muted">
        Fila de ocorrências registadas pela liderança de turma, da mais recente para a mais antiga. A triagem (estados,
        parecer e ponte para o banco de desafios) chega na Fase 3.
      </p>
      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-4 py-3">Turma</th>
              <th className="px-4 py-3">Ocorrência</th>
              <th className="px-4 py-3">Gravidade</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Registada por</th>
              <th className="px-4 py-3">Data</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0">
                <td className={`${td} font-mono text-xs font-medium`}>
                  {r.curso}
                  {r.ano_curricular}
                  {r.designacao}
                </td>
                <td className={td}>
                  <p className="font-semibold">{r.titulo}</p>
                  <p className="text-xs text-ink-muted">
                    {r.categoria}
                    {r.disciplina ? ` · ${r.disciplina}` : ""}
                  </p>
                  <p className="mt-1 max-w-prose whitespace-pre-line">{r.descricao_factual}</p>
                </td>
                <td className={td}>
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${GRAV[r.gravidade]}`}>
                    {GRAV_LABEL[r.gravidade]}
                  </span>
                </td>
                <td className={td}>{ESTADO_LABEL[r.estado]}</td>
                <td className={td}>{r.autor}</td>
                <td className={`${td} tabular-nums`}>
                  {new Date(r.criado_em).toLocaleDateString("pt-AO", { timeZone: "Africa/Luanda" })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="px-4 py-6 text-ink-muted">Ainda não há ocorrências registadas.</p>}
      </div>
    </AppShell>
  );
}

async function listarOcorrencias() {
  return getSql()`
    SELECT a.id, a.titulo, a.categoria, a.gravidade, a.estado, a.descricao_factual, a.criado_em,
           c.codigo AS curso, t.ano_curricular, t.designacao, td.disciplina, u.nome_completo AS autor
    FROM auditorias_sala a
    JOIN turmas t ON t.id = a.turma_id
    JOIN cursos c ON c.id = t.curso_id
    JOIN utilizadores u ON u.id = a.autor_id
    LEFT JOIN turma_docentes td ON td.id = a.turma_docente_id
    ORDER BY a.id DESC LIMIT 200`;
}
