import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { requireAuth } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { LIDERANCA_ROLES } from "@/lib/rbac";
import { AuditoriaForm } from "./auditoria-form";

export const metadata: Metadata = { title: "Auditoria de sala · PGAE" };

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

export default async function AuditoriaPage() {
  const user = await requireAuth(LIDERANCA_ROLES);
  // A turma vem da sessão, nunca de parâmetros do pedido.
  const turmaId = user.turmaId;
  const sql = getSql();

  const docentes = turmaId
    ? await sql`
        SELECT td.id, td.disciplina, d.nome_completo
        FROM turma_docentes td JOIN docentes d ON d.id = td.docente_id
        WHERE td.turma_id = ${turmaId} AND td.ativo ORDER BY td.disciplina`
    : [];
  const registos = turmaId
    ? await sql`
        SELECT a.id, a.titulo, a.categoria, a.gravidade, a.estado, a.criado_em
        FROM auditorias_sala a WHERE a.turma_id = ${turmaId} ORDER BY a.id DESC LIMIT 50`
    : [];

  return (
    <AppShell user={user} current="/delegado/auditoria" title="Auditoria de sala">
      {turmaId === null ? (
        <p className="text-ink-muted">A sua conta não tem turma associada. Contacte o GAE.</p>
      ) : (
        <>
          <section className="mb-8 max-w-2xl rounded-card border border-border bg-surface p-4">
            <h2 className="mb-3 font-display text-lg font-bold">Nova ocorrência</h2>
            <AuditoriaForm docentes={docentes.map((d) => ({ id: d.id, texto: `${d.disciplina} — ${d.nome_completo}` }))} />
          </section>

          <h2 className="mb-3 font-display text-lg font-bold">Ocorrências da turma</h2>
          <div className="overflow-x-auto rounded-card border border-border bg-surface">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="px-4 py-3">Título</th>
                  <th className="px-4 py-3">Gravidade</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Data</th>
                </tr>
              </thead>
              <tbody>
                {registos.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2">{r.titulo}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${GRAV[r.gravidade]}`}>
                        {GRAV_LABEL[r.gravidade]}
                      </span>
                    </td>
                    <td className="px-4 py-2">{ESTADO_LABEL[r.estado]}</td>
                    <td className="px-4 py-2 tabular-nums">
                      {new Date(r.criado_em).toLocaleDateString("pt-AO", { timeZone: "Africa/Luanda" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {registos.length === 0 && <p className="px-4 py-6 text-ink-muted">Ainda não registou ocorrências.</p>}
          </div>
        </>
      )}
    </AppShell>
  );
}
