import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import type postgres from "postgres";
import { PDFDocument } from "pdf-lib";
import { iniciarBd } from "./helpers/bd.ts";
import { associarDocente, criarCurso, criarDocente, criarFaculdade, criarTurma } from "../lib/estrutura-core.ts";
import { docentesDaTurma, submeterVoto } from "../lib/vote-core.ts";
import { registarAuditoria } from "../lib/auditoria-core.ts";
import { celulaCsv, montarRelatorio, paraCsv, paraPdf, type Relatorio } from "../lib/relatorio.ts";
import { filtrosDeQuery } from "../lib/export-params.ts";

const PEPPER = "p".repeat(64);

describe("CSV seguro", () => {
  it("neutraliza injeção de fórmulas e escapa separadores e aspas", () => {
    assert.equal(celulaCsv("=SOMA(A1:A2)"), "'=SOMA(A1:A2)");
    assert.ok(celulaCsv("+1+1").startsWith("'+"));
    assert.ok(celulaCsv("-1+1").startsWith("'"));
    assert.ok(celulaCsv("@x").startsWith("'"));
    assert.equal(celulaCsv("a;b"), '"a;b"');
    assert.equal(celulaCsv('diz "olá"'), '"diz ""olá"""');
    assert.equal(celulaCsv(null), "");
    assert.equal(celulaCsv(5), "5");
  });
});

describe("filtros da query", () => {
  it("exige ciclo numérico e ignora lixo nos restantes", () => {
    assert.equal(filtrosDeQuery(new URLSearchParams("")), null);
    assert.equal(filtrosDeQuery(new URLSearchParams("ciclo=abc")), null);
    assert.deepEqual(filtrosDeQuery(new URLSearchParams("ciclo=3&curso=2&turma=x1&faculdade=")), {
      cicloId: 3, faculdadeId: null, cursoId: 2, turmaId: null,
    });
    assert.equal(filtrosDeQuery(new URLSearchParams("ciclo=1;DROP TABLE x")), null);
  });
});

describe("relatório para a Direção", () => {
  let sql: postgres.Sql;
  let fechar: () => Promise<void>;
  let cicloId = 0;
  let rel: Relatorio;

  const votar = async (turmaId: number, id: string, nota: number, comentario: string) => {
    const docs = await docentesDaTurma(sql, turmaId);
    const r = await submeterVoto(
      sql,
      { turmaId, cicloId, idEstudante: id, notas: docs.map((d) => ({ turmaDocenteId: d.id, didatica: nota, avaliacao: nota, pontualidade: nota, comunicacao: nota, comentario })) },
      PEPPER,
    );
    assert.equal(r.ok, true);
  };

  before(async () => {
    const bd = await iniciarBd();
    sql = bd.sql;
    fechar = bd.fechar;
    const f = (await criarFaculdade(sql, { nome: "FENT", sigla: "FENT" })) as { id: number };
    const c = (await criarCurso(sql, { faculdadeId: f.id, nome: "Eng. Informática", codigo: "EI" })) as { id: number };
    const mk = async (d: "A" | "B", nome: string) => {
      const t = await criarTurma(sql, { cursoId: c.id, ano: 3, designacao: d, periodo: "MANHA", semestre: "2026-S2", totalEstimado: 10 });
      if (!t.ok) throw new Error(t.erro);
      const doc = (await criarDocente(sql, { nome, codigo: null, grau: null })) as { id: number };
      await associarDocente(sql, { turmaId: t.id, docenteId: doc.id, disciplina: `Disc ${d}` });
      return t.id;
    };
    const tA = await mk("A", "=Docente Formula");
    const tB = await mk("B", "Docente Poucos");
    const [u] = await sql`INSERT INTO utilizadores (nome_completo, identificador, password_hash, role, turma_id)
                          VALUES ('Del Autor', 'del', 'x', 'DELEGADO', ${tA}) RETURNING id`;
    const [ci] = await sql`INSERT INTO ciclos_avaliacao (titulo, semestre_letivo, data_inicio, data_fim, estado, criado_por)
                           VALUES ('Ciclo Teste', '2026-S2', NOW() - interval '1 day', NOW() + interval '7 days', 'ATIVO', ${u.id}) RETURNING id`;
    cicloId = ci.id;
    for (let i = 0; i < 5; i++) await votar(tA, `AL00${i}`, 5, `COMENTARIO-SECRETO-${i}`);
    for (let i = 0; i < 3; i++) await votar(tB, `BL00${i}`, 1, `COMENTARIO-OCULTO-${i}`);
    await registarAuditoria(sql, {
      turmaId: tA, autorId: u.id, turmaDocenteId: null, categoria: "INFRAESTRUTURA", gravidade: "CRITICA",
      titulo: "Sala sem energia", descricao: "DESCRICAO-INTERNA: a sala 3 está sem energia há dois dias.",
    });
    rel = (await montarRelatorio(sql, { cicloId }))!;
  });
  after(async () => fechar());

  it("o modelo tem KPIs, ranking e só o título e a turma das ocorrências críticas", async () => {
    assert.equal(rel.ciclo.titulo, "Ciclo Teste");
    assert.equal(rel.filtros, "Toda a universidade");
    assert.equal(rel.ranking.length, 2);
    assert.equal(rel.kpis.docentesDestaque, 1);
    assert.equal(rel.kpis.alertasCriticosAbertos, 1);
    assert.deepEqual(rel.alertasCriticos, [{ titulo: "Sala sem energia", turma: "EI3A" }]);
    assert.equal(await montarRelatorio(sql, { cicloId: 9999 }), null);
  });

  it("T5 no CSV: grupo com 3 votos sem médias; sem comentários, alunos nem descrições", () => {
    const csv = paraCsv(rel);
    assert.ok(csv.startsWith("﻿"));
    const linhas = csv.trim().split("\r\n");
    assert.equal(linhas.length, 3);
    const pouco = linhas.find((l) => l.includes("Docente Poucos"))!.split(";");
    assert.equal(pouco[5], "3");
    assert.deepEqual(pouco.slice(6, 11), ["", "", "", "", ""]);
    assert.match(pouco[11], /Amostra insuficiente/);
    for (const proibido of ["COMENTARIO", "DESCRICAO-INTERNA", "AL00", "BL00", "Del Autor"]) assert.ok(!csv.includes(proibido), proibido);
  });

  it("o CSV usa decimais com vírgula e neutraliza o nome do docente que começa por =", () => {
    const csv = paraCsv(rel);
    assert.ok(csv.includes("'=Docente Formula"));
    assert.ok(/;5,00;/.test(csv));
    assert.ok(csv.includes("Docente Destaque"));
  });

  it("o PDF é válido, com texto em português e sem dados proibidos", async () => {
    const bytes = await paraPdf(rel);
    assert.equal(Buffer.from(bytes.slice(0, 5)).toString(), "%PDF-");
    const doc = await PDFDocument.load(bytes);
    assert.ok(doc.getPageCount() >= 1);
    assert.equal(doc.getTitle(), "Relatório para a Direção - Ciclo Teste");
    const bruto = Buffer.from(bytes).toString("latin1");
    for (const proibido of ["COMENTARIO", "DESCRICAO-INTERNA", "AL00"]) assert.ok(!bruto.includes(proibido));
  });

  it("o PDF pagina listas longas", async () => {
    const muitos: Relatorio = {
      ...rel,
      ranking: Array.from({ length: 120 }, (_, i) => ({ ...rel.ranking[0], turmaDocenteId: i, docente: `Docente ${i} com um nome bastante comprido para testar o corte do texto na coluna` })),
    };
    const doc = await PDFDocument.load(await paraPdf(muitos));
    assert.ok(doc.getPageCount() >= 4, `páginas: ${doc.getPageCount()}`);
  });
});
