import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import type postgres from "postgres";
import { iniciarBd } from "./helpers/bd.ts";
import { associarDocente, criarCurso, criarDocente, criarFaculdade, criarTurma } from "../lib/estrutura-core.ts";
import { participacaoDaTurma, registarAuditoria } from "../lib/auditoria-core.ts";
import { taxaParticipacao } from "../lib/bi-metrics.ts";
import { docentesDaTurma, submeterVoto } from "../lib/vote-core.ts";
import { auditoriaSchema } from "../lib/validators.ts";

const PEPPER = "p".repeat(64);

describe("TPT", () => {
  it("calcula a percentagem, limita a 100 % e trata zeros", () => {
    assert.equal(taxaParticipacao(20, 40), 50);
    assert.equal(taxaParticipacao(60, 40), 100);
    assert.equal(taxaParticipacao(0, 40), 0);
    assert.equal(taxaParticipacao(5, 0), 0);
    assert.equal(taxaParticipacao(Number.NaN, 40), 0);
  });
});

describe("auditoria de sala e participação", () => {
  let sql: postgres.Sql;
  let fechar: () => Promise<void>;
  let turmaA = 0;
  let turmaB = 0;
  let tdA = 0;
  let tdB = 0;
  let autorA = 0;
  let cicloId = 0;

  before(async () => {
    const bd = await iniciarBd();
    sql = bd.sql;
    fechar = bd.fechar;
    const f = (await criarFaculdade(sql, { nome: "FENT", sigla: "FENT" })) as { id: number };
    const c = (await criarCurso(sql, { faculdadeId: f.id, nome: "Eng. Informática", codigo: "EI" })) as { id: number };
    const mk = async (d: "A" | "B") => {
      const t = await criarTurma(sql, { cursoId: c.id, ano: 3, designacao: d, periodo: "MANHA", semestre: "2026-S2", totalEstimado: 10 });
      if (!t.ok) throw new Error(t.erro);
      const doc = (await criarDocente(sql, { nome: `Docente ${d}`, codigo: null, grau: null })) as { id: number };
      const a = (await associarDocente(sql, { turmaId: t.id, docenteId: doc.id, disciplina: `Disc ${d}` })) as { id: number };
      return { turma: t.id, td: a.id };
    };
    const a = await mk("A");
    const b = await mk("B");
    turmaA = a.turma;
    tdA = a.td;
    turmaB = b.turma;
    tdB = b.td;
    const [u] = await sql`
      INSERT INTO utilizadores (nome_completo, identificador, password_hash, role, turma_id)
      VALUES ('Delegado A', 'del.a', 'x', 'DELEGADO', ${turmaA}) RETURNING id`;
    autorA = u.id;
    const [ci] = await sql`
      INSERT INTO ciclos_avaliacao (titulo, semestre_letivo, data_inicio, data_fim, estado, criado_por)
      VALUES ('Ciclo', '2026-S2', NOW() - interval '1 day', NOW() + interval '7 days', 'ATIVO', ${autorA}) RETURNING id`;
    cicloId = ci.id;
  });
  after(async () => fechar());

  const base = () => ({
    turmaId: turmaA,
    autorId: autorA,
    turmaDocenteId: null as number | null,
    categoria: "DIDATICA" as const,
    gravidade: "ALTA" as const,
    titulo: "Aula não lecionada",
    descricao: "O docente não compareceu à aula das 8h de segunda-feira.",
  });

  it("regista a ocorrência com a turma e o autor da sessão, em estado NOVO", async () => {
    const r = await registarAuditoria(sql, { ...base(), turmaDocenteId: tdA });
    assert.equal(r.ok, true);
    const [a] = await sql`SELECT turma_id, autor_id, estado, elegivel_fentfest FROM auditorias_sala`;
    assert.deepEqual({ ...a }, { turma_id: turmaA, autor_id: autorA, estado: "NOVO", elegivel_fentfest: false });
  });

  it("T2: um docente de outra turma é recusado como fora do escopo e nada é gravado", async () => {
    const r = await registarAuditoria(sql, { ...base(), turmaDocenteId: tdB });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.fora_do_escopo, true);
    const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM auditorias_sala WHERE turma_id = ${turmaB}`;
    assert.equal(n, 0);
  });

  it("ocorrência geral (sem docente) é aceite", async () => {
    assert.equal((await registarAuditoria(sql, base())).ok, true);
  });

  it("o formulário não aceita turma_id, remove HTML e exige factos suficientes", () => {
    const ok = auditoriaSchema.safeParse({
      turmaDocenteId: "",
      categoria: "OUTRO",
      gravidade: "BAIXA",
      titulo: "<b>Projetor</b> avariado",
      descricao: "<script>x</script>O projetor da sala 12 não liga há duas semanas.",
      turma_id: "999",
    });
    assert.equal(ok.success, true);
    if (ok.success) {
      assert.equal(ok.data.titulo, "Projetor avariado");
      assert.ok(!ok.data.descricao.includes("<"));
      assert.ok(!("turma_id" in ok.data) && !("turmaId" in ok.data));
    }
    assert.equal(auditoriaSchema.safeParse({ categoria: "OUTRO", gravidade: "BAIXA", titulo: "x", descricao: "curta" }).success, false);
    assert.equal(auditoriaSchema.safeParse({ categoria: "XPTO", gravidade: "BAIXA", titulo: "x", descricao: "a".repeat(30) }).success, false);
  });

  it("participação: conta alunos únicos da turma e não mistura turmas", async () => {
    const notas = async (turmaId: number) =>
      (await docentesDaTurma(sql, turmaId)).map((d) => ({
        turmaDocenteId: d.id, didatica: 4, avaliacao: 4, pontualidade: 4, comunicacao: 4, comentario: null,
      }));
    for (const id of ["ALUNO001", "ALUNO002", "ALUNO003"]) {
      assert.equal((await submeterVoto(sql, { turmaId: turmaA, cicloId, idEstudante: id, notas: await notas(turmaA) }, PEPPER)).ok, true);
    }
    assert.equal((await submeterVoto(sql, { turmaId: turmaB, cicloId, idEstudante: "ALUNO009", notas: await notas(turmaB) }, PEPPER)).ok, true);

    const a = await participacaoDaTurma(sql, turmaA);
    const b = await participacaoDaTurma(sql, turmaB);
    assert.equal(a[0].votos, 3);
    assert.equal(b[0].votos, 1);
    assert.equal(taxaParticipacao(a[0].votos, 10), 30);
  });

  it("rascunhos não aparecem no histórico da turma", async () => {
    await sql`INSERT INTO ciclos_avaliacao (titulo, semestre_letivo, data_inicio, data_fim, criado_por)
              VALUES ('Rascunho', '2026-S2', NOW(), NOW() + interval '3 days', ${autorA})`;
    const ciclos = await participacaoDaTurma(sql, turmaA);
    assert.ok(ciclos.every((c) => c.titulo !== "Rascunho"));
  });
});
