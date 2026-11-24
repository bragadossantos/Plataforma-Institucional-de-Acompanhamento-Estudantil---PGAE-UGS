// Regras da estrutura académica sem dependências do Next.js (testáveis contra um Postgres real).
import type { Sql } from "postgres";
import { gerarCodigoTurma } from "./codigo-turma.ts";

export const MAX_TURMAS = 4;

export type Resultado = { ok: true; id: number; extra?: string } | { ok: false; erro: string };

function violacaoUnica(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "23505";
}

export async function criarFaculdade(sql: Sql, d: { nome: string; sigla: string }): Promise<Resultado> {
  try {
    const [r] = await sql`INSERT INTO faculdades (nome, sigla) VALUES (${d.nome}, ${d.sigla.toUpperCase()}) RETURNING id`;
    return { ok: true, id: r.id };
  } catch (e) {
    if (violacaoUnica(e)) return { ok: false, erro: "Já existe uma faculdade com esse nome ou sigla." };
    throw e;
  }
}

export async function criarCurso(
  sql: Sql,
  d: { faculdadeId: number; nome: string; codigo: string },
): Promise<Resultado> {
  const [f] = await sql`SELECT 1 FROM faculdades WHERE id = ${d.faculdadeId} AND ativa`;
  if (!f) return { ok: false, erro: "Faculdade inválida ou inativa." };
  try {
    const [r] = await sql`
      INSERT INTO cursos (faculdade_id, nome, codigo)
      VALUES (${d.faculdadeId}, ${d.nome}, ${d.codigo.toUpperCase()}) RETURNING id`;
    return { ok: true, id: r.id };
  } catch (e) {
    if (violacaoUnica(e)) return { ok: false, erro: "Já existe um curso com esse nome nesta faculdade ou com esse código." };
    throw e;
  }
}

export async function criarTurma(
  sql: Sql,
  d: {
    cursoId: number;
    ano: number;
    designacao: "A" | "B" | "C" | "D";
    periodo: "MANHA" | "TARDE" | "NOITE";
    semestre: string;
    totalEstimado: number;
  },
): Promise<Resultado> {
  const [curso] = await sql`SELECT codigo FROM cursos WHERE id = ${d.cursoId} AND ativo`;
  if (!curso) return { ok: false, erro: "Curso inválido ou inativo." };

  const [{ n }] = await sql`
    SELECT COUNT(*)::int AS n FROM turmas
    WHERE curso_id = ${d.cursoId} AND ano_curricular = ${d.ano} AND semestre_letivo = ${d.semestre}`;
  if (n >= MAX_TURMAS) {
    return { ok: false, erro: `Limite de ${MAX_TURMAS} turmas (A–D) atingido para este curso, ano e semestre.` };
  }

  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const codigo = gerarCodigoTurma(curso.codigo, d.ano, d.designacao);
    try {
      const [r] = await sql`
        INSERT INTO turmas (curso_id, ano_curricular, designacao, periodo, semestre_letivo, codigo_acesso, total_estimado_alunos)
        VALUES (${d.cursoId}, ${d.ano}, ${d.designacao}, ${d.periodo}, ${d.semestre}, ${codigo}, ${d.totalEstimado})
        RETURNING id`;
      return { ok: true, id: r.id, extra: codigo };
    } catch (e) {
      if (!violacaoUnica(e)) throw e;
      const [existe] = await sql`
        SELECT 1 FROM turmas
        WHERE curso_id = ${d.cursoId} AND ano_curricular = ${d.ano}
          AND designacao = ${d.designacao} AND semestre_letivo = ${d.semestre}`;
      if (existe) return { ok: false, erro: `A turma ${d.designacao} já existe para este curso, ano e semestre.` };
      // Colisão do código de acesso: tenta outro.
    }
  }
  return { ok: false, erro: "Não foi possível gerar um código de acesso único. Tente novamente." };
}

export async function criarDocente(
  sql: Sql,
  d: { nome: string; codigo: string | null; grau: string | null },
): Promise<Resultado> {
  try {
    const [r] = await sql`
      INSERT INTO docentes (nome_completo, codigo_docente, grau_academico)
      VALUES (${d.nome}, ${d.codigo}, ${d.grau}) RETURNING id`;
    return { ok: true, id: r.id };
  } catch (e) {
    if (violacaoUnica(e)) return { ok: false, erro: "Já existe um docente com esse código." };
    throw e;
  }
}

export async function associarDocente(
  sql: Sql,
  d: { turmaId: number; docenteId: number; disciplina: string },
): Promise<Resultado> {
  const [t] = await sql`SELECT 1 FROM turmas WHERE id = ${d.turmaId}`;
  const [doc] = await sql`SELECT 1 FROM docentes WHERE id = ${d.docenteId} AND ativo`;
  if (!t) return { ok: false, erro: "Turma inválida." };
  if (!doc) return { ok: false, erro: "Docente inválido ou inativo." };
  try {
    const [r] = await sql`
      INSERT INTO turma_docentes (turma_id, docente_id, disciplina)
      VALUES (${d.turmaId}, ${d.docenteId}, ${d.disciplina}) RETURNING id`;
    return { ok: true, id: r.id };
  } catch (e) {
    if (violacaoUnica(e)) return { ok: false, erro: "Este docente já está associado a esta disciplina nesta turma." };
    throw e;
  }
}
