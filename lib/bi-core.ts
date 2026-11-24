// Consultas de BI sem dependências do Next.js. A barreira k ≥ 5 é aplicada AQUI, no SQL:
// uma linha com menos de 5 votos nunca sai da base de dados com médias ou comentários.
import type { Sql } from "postgres";
import { classificarIDD, K_MIN, taxaParticipacao, type ClasseIDD } from "./bi-metrics.ts";

export type Filtros = {
  cicloId: number;
  faculdadeId?: number | null;
  cursoId?: number | null;
  turmaId?: number | null;
};

export type LinhaDocente = {
  turmaDocenteId: number;
  docente: string;
  disciplina: string;
  turma: string;
  votos: number;
  /** false → médias e classificação ficam nulas (T5) */
  visivel: boolean;
  idd: number | null;
  didatica: number | null;
  avaliacao: number | null;
  pontualidade: number | null;
  comunicacao: number | null;
  classe: ClasseIDD | null;
};

export type Kpis = {
  adesaoGlobal: number;
  votosUnicos: number;
  alunosEstimados: number;
  mediaPedagogica: number | null;
  docentesDestaque: number;
  alertasCriticosAbertos: number;
};

function filtroTurma(sql: Sql, f: Filtros) {
  return sql`
    ${f.faculdadeId ? sql`AND c.faculdade_id = ${f.faculdadeId}` : sql``}
    ${f.cursoId ? sql`AND c.id = ${f.cursoId}` : sql``}
    ${f.turmaId ? sql`AND t.id = ${f.turmaId}` : sql``}`;
}

export async function ciclosDisponiveis(sql: Sql) {
  return sql<{ id: number; titulo: string; estado: string; semestre: string }[]>`
    SELECT id, titulo, estado, semestre_letivo AS semestre
    FROM ciclos_avaliacao WHERE estado <> 'RASCUNHO' ORDER BY (estado = 'ATIVO') DESC, id DESC`;
}

/** Ranking por docente e turma. Médias só com ≥ K_MIN votos válidos nessa disciplina e ciclo. */
export async function rankingDocentes(sql: Sql, f: Filtros): Promise<LinhaDocente[]> {
  const rows = await sql`
    SELECT td.id AS td_id, d.nome_completo AS docente, td.disciplina,
           c.codigo || t.ano_curricular || t.designacao AS turma,
           COUNT(v.id)::int AS votos,
           CASE WHEN COUNT(v.id) >= ${K_MIN} THEN
             AVG(0.35 * v.nota_didatica + 0.30 * v.nota_avaliacao + 0.20 * v.nota_pontualidade + 0.15 * v.nota_comunicacao)
           END AS idd,
           CASE WHEN COUNT(v.id) >= ${K_MIN} THEN AVG(v.nota_didatica) END AS didatica,
           CASE WHEN COUNT(v.id) >= ${K_MIN} THEN AVG(v.nota_avaliacao) END AS avaliacao,
           CASE WHEN COUNT(v.id) >= ${K_MIN} THEN AVG(v.nota_pontualidade) END AS pontualidade,
           CASE WHEN COUNT(v.id) >= ${K_MIN} THEN AVG(v.nota_comunicacao) END AS comunicacao
    FROM votos_docentes v
    JOIN turma_docentes td ON td.id = v.turma_docente_id
    JOIN docentes d ON d.id = td.docente_id
    JOIN turmas t ON t.id = td.turma_id
    JOIN cursos c ON c.id = t.curso_id
    WHERE v.ciclo_id = ${f.cicloId} ${filtroTurma(sql, f)}
    GROUP BY td.id, d.nome_completo, td.disciplina, c.codigo, t.ano_curricular, t.designacao
    ORDER BY idd DESC NULLS LAST, votos DESC, docente`;

  const n = (x: unknown) => (x === null || x === undefined ? null : Number(x));
  return rows.map((r) => {
    const idd = n(r.idd);
    return {
      turmaDocenteId: r.td_id,
      docente: r.docente,
      disciplina: r.disciplina,
      turma: r.turma,
      votos: r.votos,
      visivel: idd !== null,
      idd,
      didatica: n(r.didatica),
      avaliacao: n(r.avaliacao),
      pontualidade: n(r.pontualidade),
      comunicacao: n(r.comunicacao),
      classe: idd === null ? null : classificarIDD(idd),
    };
  });
}

/** Comentários de um docente numa turma: devolve [] se houver menos de K_MIN votos (T5). */
export async function comentariosVisiveis(sql: Sql, turmaDocenteId: number, cicloId: number): Promise<string[]> {
  const rows = await sql`
    SELECT v.comentario_curto
    FROM votos_docentes v
    WHERE v.turma_docente_id = ${turmaDocenteId} AND v.ciclo_id = ${cicloId}
      AND v.comentario_curto IS NOT NULL
      AND (SELECT COUNT(*) FROM votos_docentes w WHERE w.turma_docente_id = ${turmaDocenteId} AND w.ciclo_id = ${cicloId}) >= ${K_MIN}
    ORDER BY v.id`;
  return rows.map((r) => r.comentario_curto as string);
}

/** Votos únicos e alunos estimados por turma (um aluno vota em todos os docentes de uma vez). */
export async function participacao(sql: Sql, f: Filtros) {
  const [r] = await sql`
    SELECT COALESCE(SUM(x.votos), 0)::int AS votos, COALESCE(SUM(x.total), 0)::int AS total
    FROM (
      SELECT t.id, t.total_estimado_alunos AS total,
             COALESCE((
               SELECT MAX(n) FROM (
                 SELECT COUNT(*) AS n FROM votos_controlo vc
                 JOIN turma_docentes td ON td.id = vc.turma_docente_id
                 WHERE vc.ciclo_id = ci.id AND td.turma_id = t.id GROUP BY vc.turma_docente_id
               ) q), 0) AS votos
      FROM ciclos_avaliacao ci
      JOIN turmas t ON t.semestre_letivo = ci.semestre_letivo
      JOIN cursos c ON c.id = t.curso_id
      WHERE ci.id = ${f.cicloId} ${filtroTurma(sql, f)}
        AND EXISTS (SELECT 1 FROM turma_docentes td WHERE td.turma_id = t.id)
    ) x`;
  return { votos: r.votos as number, total: r.total as number };
}

export async function alertasCriticosAbertos(sql: Sql, f: Filtros) {
  return sql<{ id: number; titulo: string; turma: string; estado: string; criado_em: Date }[]>`
    SELECT a.id, a.titulo, c.codigo || t.ano_curricular || t.designacao AS turma, a.estado, a.criado_em
    FROM auditorias_sala a
    JOIN turmas t ON t.id = a.turma_id
    JOIN cursos c ON c.id = t.curso_id
    WHERE a.gravidade = 'CRITICA' AND a.estado IN ('NOVO', 'EM_ANALISE', 'ENCAMINHADO_DIRECAO')
      ${filtroTurma(sql, f)}
    ORDER BY a.id DESC`;
}

export async function calcularKpis(sql: Sql, f: Filtros, ranking?: LinhaDocente[]): Promise<Kpis> {
  const linhas = ranking ?? (await rankingDocentes(sql, f));
  const visiveis = linhas.filter((l) => l.visivel && l.idd !== null);
  const totalVotos = visiveis.reduce((s, l) => s + l.votos, 0);
  const media = totalVotos === 0 ? null : visiveis.reduce((s, l) => s + (l.idd as number) * l.votos, 0) / totalVotos;
  const p = await participacao(sql, f);
  const alertas = await alertasCriticosAbertos(sql, f);
  return {
    adesaoGlobal: taxaParticipacao(p.votos, p.total),
    votosUnicos: p.votos,
    alunosEstimados: p.total,
    mediaPedagogica: media,
    docentesDestaque: visiveis.filter((l) => l.classe === "DESTAQUE").length,
    alertasCriticosAbertos: alertas.length,
  };
}
