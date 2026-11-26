// Motor de voto cego, sem dependências do Next.js (testável contra um Postgres real).
import { randomInt } from "node:crypto";
import type { Sql } from "postgres";
import { calcularNullifier, idEstudanteValido, normalizarIdEstudante } from "./crypto-vote.ts";

export const CATEGORIAS_INQUIETACAO = [
  "ACADEMICO",
  "LABORATORIOS",
  "SECRETARIA",
  "HORARIOS",
  "INFRAESTRUTURA",
  "TECNOLOGIA",
] as const;
export type CategoriaInquietacao = (typeof CATEGORIAS_INQUIETACAO)[number];

export type NotasDocente = {
  turmaDocenteId: number;
  didatica: number;
  avaliacao: number;
  pontualidade: number;
  comunicacao: number;
  comentario: string | null;
};

export type VotoInput = {
  turmaId: number;
  cicloId: number;
  idEstudante: string;
  notas: NotasDocente[];
  inquietacao?: { categoria: CategoriaInquietacao; descricao: string } | null;
};

export type ResultadoVoto =
  | { ok: true }
  | { ok: false; erro: string; motivo: "DUPLICADO" | "INVALIDO" | "CICLO_FECHADO" };

class VotoDuplicado extends Error {}

export type Contexto = { turmaId: number; cicloId: number; cicloTitulo: string };

/** Código de turma → turma e ciclo ativo desse semestre. null se o código não serve. */
export async function resolverCodigo(sql: Sql, codigo: string): Promise<Contexto | null> {
  const c = codigo.trim().toUpperCase();
  if (!/^[A-Z0-9-]{4,16}$/.test(c)) return null;
  const [r] = await sql`
    SELECT t.id AS turma_id, ci.id AS ciclo_id, ci.titulo
    FROM turmas t
    JOIN ciclos_avaliacao ci ON ci.semestre_letivo = t.semestre_letivo
    WHERE t.codigo_acesso = ${c} AND t.codigo_ativo
      AND ci.estado = 'ATIVO' AND NOW() BETWEEN ci.data_inicio AND ci.data_fim
    ORDER BY ci.id DESC LIMIT 1`;
  return r ? { turmaId: r.turma_id, cicloId: r.ciclo_id, cicloTitulo: r.titulo } : null;
}

/** Docentes ativos da turma que o aluno vai avaliar. */
export async function docentesDaTurma(sql: Sql, turmaId: number) {
  return sql<{ id: number; disciplina: string; nome: string }[]>`
    SELECT td.id, td.disciplina, d.nome_completo AS nome
    FROM turma_docentes td JOIN docentes d ON d.id = td.docente_id
    WHERE td.turma_id = ${turmaId} AND td.ativo AND d.ativo
    ORDER BY td.disciplina`;
}

/** O aluno já votou neste ciclo (em qualquer docente desta turma)? Só consulta nullifiers. */
export async function jaVotou(
  sql: Sql,
  d: { turmaId: number; cicloId: number; idEstudante: string },
  pepper: string,
): Promise<boolean> {
  const id = normalizarIdEstudante(d.idEstudante);
  const tds = await docentesDaTurma(sql, d.turmaId);
  if (tds.length === 0) return false;
  const hashes = tds.map((t) => calcularNullifier(pepper, id, t.id, d.cicloId));
  const [r] = await sql`SELECT 1 FROM votos_controlo WHERE nullifier_hash IN ${sql(hashes)} LIMIT 1`;
  return Boolean(r);
}

function notaValida(n: unknown): boolean {
  return Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 5;
}

function embaralhar<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

/**
 * Voto cego, numa única transação atómica:
 *  1) valida ciclo ativo e que as notas cobrem exatamente os docentes ativos da turma;
 *  2) para cada docente: insere o nullifier em votos_controlo (UNIQUE) — se já existir, tudo é revertido;
 *  3) insere as notas em votos_docentes (UUID aleatório, data truncada ao dia, sem IP nem aluno).
 * O identificador do aluno só existe nesta função, em memória.
 */
export async function submeterVoto(sql: Sql, v: VotoInput, pepper: string): Promise<ResultadoVoto> {
  const id = normalizarIdEstudante(v.idEstudante);
  if (!idEstudanteValido(id)) return { ok: false, motivo: "INVALIDO", erro: "Número de estudante inválido." };

  const [ciclo] = await sql`
    SELECT ci.id FROM ciclos_avaliacao ci JOIN turmas t ON t.semestre_letivo = ci.semestre_letivo
    WHERE ci.id = ${v.cicloId} AND t.id = ${v.turmaId} AND t.codigo_ativo
      AND ci.estado = 'ATIVO' AND NOW() BETWEEN ci.data_inicio AND ci.data_fim`;
  if (!ciclo) return { ok: false, motivo: "CICLO_FECHADO", erro: "A votação não está aberta para esta turma." };

  const tds = await docentesDaTurma(sql, v.turmaId);
  const esperados = new Set(tds.map((t) => t.id));
  const recebidos = new Set(v.notas.map((n) => n.turmaDocenteId));
  const completo =
    esperados.size > 0 &&
    recebidos.size === v.notas.length &&
    recebidos.size === esperados.size &&
    [...recebidos].every((x) => esperados.has(x));
  if (!completo) return { ok: false, motivo: "INVALIDO", erro: "Avalie todos os docentes da turma." };
  for (const n of v.notas) {
    if (![n.didatica, n.avaliacao, n.pontualidade, n.comunicacao].every(notaValida)) {
      return { ok: false, motivo: "INVALIDO", erro: "Todas as notas têm de estar entre 1 e 5." };
    }
  }

  try {
    await sql.begin(async (tx) => {
      for (const n of embaralhar(v.notas)) {
        const hash = calcularNullifier(pepper, id, n.turmaDocenteId, v.cicloId);
        const [ins] = await tx`
          INSERT INTO votos_controlo (ciclo_id, turma_docente_id, nullifier_hash)
          VALUES (${v.cicloId}, ${n.turmaDocenteId}, ${hash})
          ON CONFLICT (nullifier_hash) DO NOTHING RETURNING id`;
        if (!ins) throw new VotoDuplicado();
        await tx`
          INSERT INTO votos_docentes
            (ciclo_id, turma_docente_id, nota_didatica, nota_avaliacao, nota_pontualidade, nota_comunicacao, comentario_curto)
          VALUES (${v.cicloId}, ${n.turmaDocenteId}, ${n.didatica}, ${n.avaliacao}, ${n.pontualidade}, ${n.comunicacao},
                  ${n.comentario})`;
      }
      if (v.inquietacao) {
        await tx`
          INSERT INTO inquietacoes_estudantis (ciclo_id, turma_id, categoria, descricao)
          VALUES (${v.cicloId}, ${v.turmaId}, ${v.inquietacao.categoria}, ${v.inquietacao.descricao})`;
      }
    });
  } catch (e) {
    if (e instanceof VotoDuplicado) {
      return { ok: false, motivo: "DUPLICADO", erro: "Já votaste neste ciclo. Cada estudante só pode votar uma vez." };
    }
    throw e;
  }
  return { ok: true };
}
