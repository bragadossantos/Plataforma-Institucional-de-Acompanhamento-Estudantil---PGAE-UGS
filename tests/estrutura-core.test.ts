import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import type postgres from "postgres";
import { iniciarBd } from "./helpers/bd.ts";
import { gerarCodigoTurma } from "../lib/codigo-turma.ts";
import {
  associarDocente,
  criarCurso,
  criarDocente,
  criarFaculdade,
  criarTurma,
} from "../lib/estrutura-core.ts";

let sql: postgres.Sql;
let fechar: () => Promise<void>;
let cursoId = 0;

const turma = (designacao: "A" | "B" | "C" | "D", ano = 3, semestre = "2026-S2") => ({
  cursoId,
  ano,
  designacao,
  periodo: "MANHA" as const,
  semestre,
  totalEstimado: 40,
});

describe("código de turma", () => {
  it("tem o formato PREFIXO-XXXX e cabe em 16 caracteres, sem caracteres ambíguos", () => {
    for (let i = 0; i < 200; i++) {
      const c = gerarCodigoTurma("EI", 3, "A");
      assert.match(c, /^EI3A-[2-9A-HJKMNP-Z]{4}$/);
      assert.ok(c.length <= 16);
    }
    assert.ok(gerarCodigoTurma("ENGENHARIA-INFORMATICA", 5, "D").length <= 16);
  });
});

describe("estrutura académica", () => {
  before(async () => {
    const bd = await iniciarBd();
    sql = bd.sql;
    fechar = bd.fechar;
  });
  after(async () => fechar());

  it("cria faculdade e curso e rejeita duplicados", async () => {
    const f = await criarFaculdade(sql, { nome: "Faculdade de Engenharia", sigla: "fent" });
    assert.equal(f.ok, true);
    assert.equal((await criarFaculdade(sql, { nome: "Outra", sigla: "FENT" })).ok, false);
    const c = await criarCurso(sql, { faculdadeId: (f as { id: number }).id, nome: "Eng. Informática", codigo: "ei" });
    assert.equal(c.ok, true);
    cursoId = (c as { id: number }).id;
    assert.equal((await criarCurso(sql, { faculdadeId: (f as { id: number }).id, nome: "Outro", codigo: "EI" })).ok, false);
  });

  it("curso exige faculdade ativa", async () => {
    const r = await criarCurso(sql, { faculdadeId: 9999, nome: "X", codigo: "X1" });
    assert.deepEqual(r, { ok: false, erro: "Faculdade inválida ou inativa." });
  });

  it("T7: cria as turmas A–D e bloqueia a 5.ª no mesmo curso/ano/semestre", async () => {
    for (const d of ["A", "B", "C", "D"] as const) {
      const r = await criarTurma(sql, turma(d));
      assert.equal(r.ok, true, `turma ${d}`);
      if (r.ok) assert.match(r.extra ?? "", /^EI3[A-D]-/);
    }
    const quinta = await criarTurma(sql, turma("A"));
    assert.equal(quinta.ok, false);
    if (!quinta.ok) assert.match(quinta.erro, /Limite de 4 turmas/);
  });

  it("outro ano ou semestre tem as suas próprias 4 turmas", async () => {
    assert.equal((await criarTurma(sql, turma("A", 4))).ok, true);
    assert.equal((await criarTurma(sql, turma("A", 3, "2027-S1"))).ok, true);
  });

  it("curso inativo não aceita turmas", async () => {
    await sql`UPDATE cursos SET ativo = FALSE WHERE id = ${cursoId}`;
    assert.equal((await criarTurma(sql, turma("B", 5))).ok, false);
    await sql`UPDATE cursos SET ativo = TRUE WHERE id = ${cursoId}`;
  });

  it("docentes: código único e associação a turma sem duplicar disciplina", async () => {
    const d = await criarDocente(sql, { nome: "Docente Teste", codigo: "D001", grau: "Mestre" });
    assert.equal(d.ok, true);
    assert.equal((await criarDocente(sql, { nome: "Outro", codigo: "D001", grau: null })).ok, false);
    assert.equal((await criarDocente(sql, { nome: "Sem código", codigo: null, grau: null })).ok, true);
    assert.equal((await criarDocente(sql, { nome: "Sem código 2", codigo: null, grau: null })).ok, true);

    const [t] = await sql`SELECT id FROM turmas LIMIT 1`;
    const docenteId = (d as { id: number }).id;
    assert.equal((await associarDocente(sql, { turmaId: t.id, docenteId, disciplina: "Algoritmos" })).ok, true);
    assert.equal((await associarDocente(sql, { turmaId: t.id, docenteId, disciplina: "Algoritmos" })).ok, false);
    assert.equal((await associarDocente(sql, { turmaId: t.id, docenteId, disciplina: "Redes" })).ok, true);
  });

  it("não associa docente inativo nem turma inexistente", async () => {
    const [t] = await sql`SELECT id FROM turmas LIMIT 1`;
    const [d] = await sql`INSERT INTO docentes (nome_completo, ativo) VALUES ('Inativo', FALSE) RETURNING id`;
    assert.equal((await associarDocente(sql, { turmaId: t.id, docenteId: d.id, disciplina: "X" })).ok, false);
    assert.equal((await associarDocente(sql, { turmaId: 99999, docenteId: d.id, disciplina: "X" })).ok, false);
  });
});
