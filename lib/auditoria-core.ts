// Auditoria de sala de aula (liderança de turma → GAE), sem dependências do Next.js.
import type { Sql } from "postgres";

export const CATEGORIAS_AUDITORIA = ["DIDATICA", "AVALIACAO", "ASSIDUIDADE", "INFRAESTRUTURA", "CONDUTA", "OUTRO"] as const;
export const GRAVIDADES = ["BAIXA", "MEDIA", "ALTA", "CRITICA"] as const;
export type CategoriaAuditoria = (typeof CATEGORIAS_AUDITORIA)[number];
export type Gravidade = (typeof GRAVIDADES)[number];

export type ResultadoAuditoria =
  | { ok: true; id: number }
  | { ok: false; erro: string; fora_do_escopo?: boolean };

/**
 * Regista uma ocorrência. `turmaId` e `autorId` vêm SEMPRE da sessão do servidor (T2):
 * o cliente só escolhe, no máximo, um turma_docente, e este tem de pertencer à turma da sessão.
 */
export async function registarAuditoria(
  sql: Sql,
  d: {
    turmaId: number;
    autorId: number;
    turmaDocenteId: number | null;
    categoria: CategoriaAuditoria;
    gravidade: Gravidade;
    titulo: string;
    descricao: string;
  },
): Promise<ResultadoAuditoria> {
  if (d.turmaDocenteId !== null) {
    const [td] = await sql`SELECT 1 FROM turma_docentes WHERE id = ${d.turmaDocenteId} AND turma_id = ${d.turmaId}`;
    if (!td) return { ok: false, erro: "Docente fora da sua turma.", fora_do_escopo: true };
  }
  const [r] = await sql`
    INSERT INTO auditorias_sala (turma_id, turma_docente_id, autor_id, categoria, gravidade, titulo, descricao_factual)
    VALUES (${d.turmaId}, ${d.turmaDocenteId}, ${d.autorId}, ${d.categoria}, ${d.gravidade}, ${d.titulo}, ${d.descricao})
    RETURNING id`;
  return { ok: true, id: r.id };
}

/** Participação por ciclo na turma: votos únicos = alunos que votaram (todos os docentes são votados em conjunto). */
export async function participacaoDaTurma(sql: Sql, turmaId: number) {
  return sql<{ id: number; titulo: string; estado: string; votos: number }[]>`
    SELECT ci.id, ci.titulo, ci.estado,
           COALESCE((
             SELECT MAX(n) FROM (
               SELECT COUNT(*)::int AS n
               FROM votos_controlo vc JOIN turma_docentes td ON td.id = vc.turma_docente_id
               WHERE vc.ciclo_id = ci.id AND td.turma_id = ${turmaId}
               GROUP BY vc.turma_docente_id
             ) x
           ), 0)::int AS votos
    FROM ciclos_avaliacao ci
    JOIN turmas t ON t.id = ${turmaId} AND t.semestre_letivo = ci.semestre_letivo
    WHERE ci.estado <> 'RASCUNHO'
    ORDER BY ci.id DESC`;
}
