// Ciclos de avaliação e códigos de turma, sem dependências do Next.js.
import type { Sql } from "postgres";
import { gerarCodigoTurma } from "./codigo-turma.ts";

export type Res = { ok: true; id: number; extra?: string } | { ok: false; erro: string };

// Luanda: UTC+1, sem horário de verão.
const inicioDoDia = (d: string) => `${d}T00:00:00+01:00`;
const fimDoDia = (d: string) => `${d}T23:59:59+01:00`;

export async function criarCiclo(
  sql: Sql,
  d: { titulo: string; semestre: string; inicio: string; fim: string },
  criadoPor: number,
): Promise<Res> {
  if (d.fim < d.inicio) return { ok: false, erro: "A data de fim não pode ser anterior à de início." };
  const [r] = await sql`
    INSERT INTO ciclos_avaliacao (titulo, semestre_letivo, data_inicio, data_fim, criado_por)
    VALUES (${d.titulo}, ${d.semestre}, ${inicioDoDia(d.inicio)}, ${fimDoDia(d.fim)}, ${criadoPor})
    RETURNING id`;
  return { ok: true, id: r.id };
}

/** RASCUNHO → ATIVO. Só um ciclo ativo por semestre; exige turmas com docentes. */
export async function abrirCiclo(sql: Sql, id: number): Promise<Res> {
  const [c] = await sql`SELECT estado, semestre_letivo, data_fim FROM ciclos_avaliacao WHERE id = ${id}`;
  if (!c) return { ok: false, erro: "Ciclo não encontrado." };
  if (c.estado !== "RASCUNHO") return { ok: false, erro: "Só se abre um ciclo em rascunho." };
  if (new Date(c.data_fim) < new Date()) return { ok: false, erro: "A data de fim deste ciclo já passou." };

  const [ativo] = await sql`
    SELECT 1 FROM ciclos_avaliacao WHERE estado = 'ATIVO' AND semestre_letivo = ${c.semestre_letivo}`;
  if (ativo) return { ok: false, erro: "Já existe um ciclo ativo neste semestre. Encerre-o primeiro." };

  const [{ n }] = await sql`
    SELECT COUNT(DISTINCT t.id)::int AS n
    FROM turmas t JOIN turma_docentes td ON td.turma_id = t.id AND td.ativo
    WHERE t.semestre_letivo = ${c.semestre_letivo}`;
  if (n === 0) return { ok: false, erro: "Não há turmas com docentes associados neste semestre." };

  await sql`UPDATE ciclos_avaliacao SET estado = 'ATIVO' WHERE id = ${id}`;
  return { ok: true, id, extra: `${n} turmas podem votar.` };
}

/** ATIVO → ENCERRADO. Definitivo: um ciclo encerrado não volta a abrir. */
export async function encerrarCiclo(sql: Sql, id: number): Promise<Res> {
  const [r] = await sql`UPDATE ciclos_avaliacao SET estado = 'ENCERRADO' WHERE id = ${id} AND estado = 'ATIVO' RETURNING id`;
  return r ? { ok: true, id } : { ok: false, erro: "Só se encerra um ciclo ativo." };
}

/** Novo código de acesso (o anterior deixa de funcionar de imediato) e reativa o acesso. */
export async function rodarCodigo(sql: Sql, turmaId: number): Promise<Res> {
  const [t] = await sql`
    SELECT t.ano_curricular, t.designacao, c.codigo AS curso
    FROM turmas t JOIN cursos c ON c.id = t.curso_id WHERE t.id = ${turmaId}`;
  if (!t) return { ok: false, erro: "Turma não encontrada." };
  for (let i = 0; i < 5; i++) {
    const codigo = gerarCodigoTurma(t.curso, t.ano_curricular, t.designacao);
    try {
      await sql`UPDATE turmas SET codigo_acesso = ${codigo}, codigo_ativo = TRUE WHERE id = ${turmaId}`;
      return { ok: true, id: turmaId, extra: codigo };
    } catch (e) {
      if ((e as { code?: string }).code !== "23505") throw e;
    }
  }
  return { ok: false, erro: "Não foi possível gerar um código único. Tente novamente." };
}

export async function alternarCodigoAtivo(sql: Sql, turmaId: number): Promise<Res & { ativo?: boolean }> {
  const [r] = await sql`UPDATE turmas SET codigo_ativo = NOT codigo_ativo WHERE id = ${turmaId} RETURNING codigo_ativo`;
  return r ? { ok: true, id: turmaId, ativo: r.codigo_ativo } : { ok: false, erro: "Turma não encontrada." };
}
