import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import type postgres from "postgres";
import { iniciarBd } from "./helpers/bd.ts";
import { associarDocente, criarCurso, criarDocente, criarFaculdade, criarTurma } from "../lib/estrutura-core.ts";
import { registarAuditoria } from "../lib/auditoria-core.ts";
import { definirFentFest } from "../lib/triagem-core.ts";
import { bancoDeDesafios, temaDaOcorrencia } from "../lib/insights-core.ts";
import { INSIGHTS_ROLES, isAllowed } from "../lib/rbac.ts";

describe("Banco de Desafios (Observador)", () => {
  let sql: postgres.Sql;
  let fechar: () => Promise<void>;
  let turmaId = 0;

  before(async () => {
    const bd = await iniciarBd();
    sql = bd.sql;
    fechar = bd.fechar;
    const f = (await criarFaculdade(sql, { nome: "FENT", sigla: "FENT" })) as { id: number };
    const c = (await criarCurso(sql, { faculdadeId: f.id, nome: "Eng. Informática", codigo: "EI" })) as { id: number };
    const t = await criarTurma(sql, { cursoId: c.id, ano: 3, designacao: "A", periodo: "MANHA", semestre: "2026-S2", totalEstimado: 40 });
    if (!t.ok) throw new Error(t.erro);
    turmaId = t.id;
    const d = (await criarDocente(sql, { nome: "Carlos Mateus", codigo: "D-SEGREDO", grau: null })) as { id: number };
    const td = (await associarDocente(sql, { turmaId, docenteId: d.id, disciplina: "Redes" })) as { id: number };
    const [u] = await sql`INSERT INTO utilizadores (nome_completo, identificador, password_hash, role, turma_id)
                          VALUES ('Beatriz Lopes', 'del.secreto', 'x', 'DELEGADO', ${turmaId}) RETURNING id`;
    const base = { turmaId, autorId: u.id, gravidade: "ALTA" as const };

    // Aprovada (infraestrutura) · aprovada (didática, com docente) · NÃO aprovada · aprovada sem resumo (impossível, forçada)
    const a = (await registarAuditoria(sql, { ...base, turmaDocenteId: null, categoria: "INFRAESTRUTURA", titulo: "TITULO-INTERNO-1", descricao: "Descrição interna confidencial número um." })) as { id: number };
    const b = (await registarAuditoria(sql, { ...base, turmaDocenteId: td.id, categoria: "DIDATICA", titulo: "TITULO-INTERNO-2", descricao: "Descrição interna confidencial número dois." })) as { id: number };
    await registarAuditoria(sql, { ...base, turmaDocenteId: null, categoria: "CONDUTA", titulo: "TITULO-INTERNO-3", descricao: "Descrição interna confidencial número três." });
    const forcada = (await registarAuditoria(sql, { ...base, turmaDocenteId: null, categoria: "OUTRO", titulo: "TITULO-INTERNO-4", descricao: "Descrição interna confidencial número quatro." })) as { id: number };

    assert.equal((await definirFentFest(sql, a.id, true, "Salas de aula sem iluminação durante vários dias")).ok, true);
    assert.equal((await definirFentFest(sql, b.id, true, "Aulas de uma disciplina técnica não foram dadas durante semanas")).ok, true);
    await sql`UPDATE auditorias_sala SET elegivel_fentfest = TRUE WHERE id = ${forcada.id}`; // sem resumo

    await sql`INSERT INTO inquietacoes_estudantis (turma_id, categoria, descricao, visivel_fentfest)
              VALUES (${turmaId}, 'TECNOLOGIA', 'Wi-Fi fraco nas salas', TRUE),
                     (${turmaId}, 'TECNOLOGIA', 'Sem tomadas para portáteis', TRUE),
                     (${turmaId}, 'HORARIOS', 'Horário dos laboratórios pouco claro', FALSE)`;
  });
  after(async () => fechar());

  it("só mostra o que o GAE aprovou, agrupado por tema e ordenado por volume", async () => {
    const g = await bancoDeDesafios(sql);
    assert.deepEqual(g.map((x) => [x.tema, x.total]), [
      ["TECNOLOGIA", 2],
      ["ACADEMICO", 1],
      ["INFRAESTRUTURA", 1],
    ]);
    const tec = g[0];
    assert.equal(tec.estudantes, 2);
    assert.equal(tec.gae, 0);
    assert.ok(g.find((x) => x.tema === "ACADEMICO")!.itens[0].origem === "GAE");
  });

  it("não inclui o que não foi aprovado nem aprovado sem resumo", async () => {
    const texto = JSON.stringify(await bancoDeDesafios(sql));
    assert.ok(!texto.includes("Horário dos laboratórios pouco claro"));
    assert.ok(!texto.includes("OUTRO"));
  });

  it("barreira: nenhum título, descrição interna, docente, autor, código ou turma sai nas consultas", async () => {
    const texto = JSON.stringify(await bancoDeDesafios(sql));
    for (const proibido of [
      "TITULO-INTERNO", "confidencial", "Carlos", "Mateus", "Beatriz", "Lopes", "del.secreto", "D-SEGREDO", "Redes", "EI3A",
    ]) {
      assert.ok(!texto.includes(proibido), `vazou: ${proibido}`);
    }
    for (const g of await bancoDeDesafios(sql)) {
      assert.deepEqual(Object.keys(g).sort(), ["estudantes", "gae", "itens", "label", "tema", "total"]);
      for (const i of g.itens) assert.deepEqual(Object.keys(i).sort(), ["origem", "texto"]);
    }
  });

  it("mapeia categorias de ocorrência para temas", () => {
    assert.equal(temaDaOcorrencia("INFRAESTRUTURA"), "INFRAESTRUTURA");
    assert.equal(temaDaOcorrencia("DIDATICA"), "ACADEMICO");
    assert.equal(temaDaOcorrencia("CONDUTA"), "ACADEMICO");
    assert.equal(temaDaOcorrencia("OUTRO"), "OUTRO");
  });

  it("T6: perfis com acesso a /insights são o Observador e o GAE; delegados não", () => {
    assert.equal(isAllowed("FENT_OBSERVER", INSIGHTS_ROLES), true);
    assert.equal(isAllowed("GAE_ADMIN", INSIGHTS_ROLES), true);
    assert.equal(isAllowed("GAE_ANALISTA", INSIGHTS_ROLES), true);
    assert.equal(isAllowed("DELEGADO", INSIGHTS_ROLES), false);
    assert.equal(isAllowed("SECRETARIO", INSIGHTS_ROLES), false);
  });
});
