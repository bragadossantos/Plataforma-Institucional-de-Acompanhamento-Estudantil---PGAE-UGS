import type { Metadata } from "next";
import { AcaoLinha } from "@/components/acao-linha";
import { AppShell } from "@/components/app-shell";
import { Campo, Selecao, Selo } from "@/components/campos";
import { FormAcao } from "@/components/form-acao";
import { requireAuth } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { criarUtilizadorAction, alternarUtilizadorAction, redefinirPasswordAction } from "./actions";

export const metadata: Metadata = { title: "Utilizadores · PGAE" };

const PERFIS = [
  { valor: "GAE_ADMIN", texto: "Administrador GAE" },
  { valor: "GAE_ANALISTA", texto: "Analista GAE" },
  { valor: "DELEGADO", texto: "Delegado" },
  { valor: "SUBDELEGADO", texto: "Subdelegado" },
  { valor: "SECRETARIO", texto: "Secretário" },
  { valor: "FENT_OBSERVER", texto: "Observador" },
];
const PERFIL_LABEL = Object.fromEntries(PERFIS.map((p) => [p.valor, p.texto]));
const td = "px-4 py-2 align-top";

export default async function UtilizadoresPage() {
  const user = await requireAuth(["GAE_ADMIN"]);
  const sql = getSql();

  const turmas = await sql`
    SELECT t.id, c.codigo, t.ano_curricular, t.designacao, t.semestre_letivo
    FROM turmas t JOIN cursos c ON c.id = t.curso_id
    ORDER BY t.semestre_letivo DESC, c.codigo, t.ano_curricular, t.designacao`;
  const rows = await sql`
    SELECT u.id, u.nome_completo, u.identificador, u.role, u.ativo, u.must_change_password, COALESCE(u.bloqueado_ate > NOW(), FALSE) AS bloqueado,
           c.codigo AS curso, t.ano_curricular, t.designacao
    FROM utilizadores u
    LEFT JOIN turmas t ON t.id = u.turma_id
    LEFT JOIN cursos c ON c.id = t.curso_id
    ORDER BY u.ativo DESC, u.role, u.nome_completo`;

  return (
    <AppShell user={user} current="/gae/utilizadores" title="Utilizadores">
      <section className="mb-6 rounded-card border border-border bg-surface p-4">
        <h2 className="mb-1 font-display text-lg font-bold">Novo utilizador</h2>
        <p className="mb-3 text-sm text-ink-muted">
          A palavra-passe provisória é gerada pelo sistema e mostrada uma única vez. Cada turma pode ter 1 Delegado, 1
          Subdelegado e 1 Secretário ativos.
        </p>
        <FormAcao action={criarUtilizadorAction} submit="Criar utilizador">
          <Campo label="Nome completo" name="nome" />
          <Campo label="E-mail institucional ou n.º" name="identificador" />
          <Selecao label="Perfil" name="role" opcoes={PERFIS} />
          <div>
            <label htmlFor="turmaId" className="text-sm font-semibold">
              Turma (só para Delegado, Subdelegado e Secretário)
            </label>
            <select
              id="turmaId"
              name="turmaId"
              defaultValue=""
              className="mt-1 min-h-11 w-full rounded-control border border-border bg-surface px-3 text-base"
            >
              <option value="">— sem turma —</option>
              {turmas.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.codigo}
                  {t.ano_curricular}
                  {t.designacao} · {t.semestre_letivo}
                </option>
              ))}
            </select>
          </div>
        </FormAcao>
      </section>

      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Perfil</th>
              <th className="px-4 py-3">Turma</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => {
              return (
                <tr key={u.id} className="border-b border-border last:border-0">
                  <td className={td}>
                    <p className="font-semibold">{u.nome_completo}</p>
                    <p className="font-mono text-xs text-ink-muted">{u.identificador}</p>
                  </td>
                  <td className={td}>{PERFIL_LABEL[u.role]}</td>
                  <td className={`${td} font-mono text-xs font-medium`}>
                    {u.curso ? `${u.curso}${u.ano_curricular}${u.designacao}` : "—"}
                  </td>
                  <td className={td}>
                    <div className="flex flex-wrap gap-1">
                      <Selo ativo={u.ativo} />
                      {u.bloqueado && (
                        <span className="inline-flex rounded-full bg-crit-bg px-2.5 py-0.5 text-xs font-semibold text-crit">
                          Bloqueado
                        </span>
                      )}
                      {u.must_change_password && (
                        <span className="inline-flex rounded-full bg-warn-bg px-2.5 py-0.5 text-xs font-semibold text-warn">
                          Aguarda 1.º acesso
                        </span>
                      )}
                    </div>
                  </td>
                  <td className={td}>
                    <div className="flex flex-wrap gap-2">
                      <AcaoLinha action={alternarUtilizadorAction} id={u.id} label={u.ativo ? "Desativar" : "Ativar"} />
                      {u.ativo && <AcaoLinha action={redefinirPasswordAction} id={u.id} label="Nova palavra-passe" />}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
