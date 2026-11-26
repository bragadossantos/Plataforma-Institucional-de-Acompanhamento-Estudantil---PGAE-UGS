import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import type postgres from "postgres";
import { iniciarBd } from "./helpers/bd.ts";
import { associarDocente, criarCurso, criarDocente, criarFaculdade, criarTurma } from "../lib/estrutura-core.ts";
import { docentesDaTurma, submeterVoto } from "../lib/vote-core.ts";
import { registarAuditoria } from "../lib/auditoria-core.ts";
import { alertasCriticosAbertos, calcularKpis, comentariosVisiveis, rankingDocentes } from "../lib/bi-core.ts";
import { calcularIDD, classificarIDD, K_MIN, notaPonderada, amostraSuficiente } from "../lib/bi-metrics.ts";

const PEPPER = "p".repeat(64);

describe("fórmulas de BI (secção 6)", () => {
  it("IDD: 0,35·D + 0,30·A + 0,20·P + 0,15·C", () => {
    assert.equal(notaPonderada({ didatica: 5, avaliacao: 5, pontualidade: 5, comunicacao: 5 }), 5);
    assert.ok(Math.abs(notaPonderada({ didatica: 4, avaliacao: 3, pontualidade: 2, comunicacao: 1 }) - 2.85) < 1e-9);
  });

  it("IDD só existe com k ≥ 5 votos", () => {
    const v = { didatica: 4, avaliacao: 4, pontualidade: 4, comunicacao: 4 };
    assert.equal(K_MIN, 5);
    assert.equal(calcularIDD([v, v, v, v]), null);
    assert.ok(Math.abs(calcularIDD([v, v, v, v, v])! - 4) < 1e-9);
    assert.equal(amostraSuficiente(4), false);
    assert.equal(amostraSuficiente(5), true);
  });

  it("classificação: ≥ 4,20 Destaque · ≥ 3,00 Estável · < 3,00 Alerta (nos limites)", () => {
    assert.equal(classificarIDD(4.2), "DESTAQUE");
    assert.equal(classificarIDD(4.19), "ESTAVEL");
    assert.equal(classificarIDD(3.0), "ESTAVEL");
    assert.equal(classificarIDD(2.99), "ALERTA");
    assert.equal(classificarIDD(4.199999999999), "DESTAQUE"); // erro de vírgula flutuante
    assert.equal(classificarIDD(2.99999999999), "ESTAVEL");
  });
});

describe("consultas de BI com barreira k", () => {
  let sql: postgres.Sql;
  let fechar: () => Promise<void>;
  let cicloId = 0;
  let cursoId = 0;
  let faculdadeId = 0;
  let turmaA = 0;
  let turmaB = 0;
  let tdA = 0;
  let tdB = 0;
  let autor = 0;

  const votar = async (turmaId: number, id: string, nota: number, comentario: string | null = null) => {
    const docs = await docentesDaTurma(sql, turmaId);
    const r = await submeterVoto(
      sql,
      {
        turmaId, cicloId, idEstudante: id,
        notas: docs.map((d) => ({ turmaDocenteId: d.id, didatica: nota, avaliacao: nota, pontualidade: nota, comunicacao: nota, comentario })),
      },
      PEPPER,
    );
    assert.equal(r.ok, true);
  };

  before(async () => {
    const bd = await iniciarBd();
    sql = bd.sql;
    fechar = bd.fechar;
    const f = (await criarFaculdade(sql, { nome: "FENT", sigla: "FENT" })) as { id: number };
    faculdadeId = f.id;
    const c = (await criarCurso(sql, { faculdadeId: f.id, nome: "Eng. Informática", codigo: "EI" })) as { id: number };
    cursoId = c.id;
    const mk = async (d: "A" | "B", nome: string) => {
      const t = await criarTurma(sql, { cursoId: c.id, ano: 3, designacao: d, periodo: "MANHA", semestre: "2026-S2", totalEstimado: 10 });
      if (!t.ok) throw new Error(t.erro);
      const doc = (await criarDocente(sql, { nome, codigo: null, grau: null })) as { id: number };
      const a = (await associarDocente(sql, { turmaId: t.id, docenteId: doc.id, disciplina: `Disc ${d}` })) as { id: number };
      return { turma: t.id, td: a.id };
    };
    const a = await mk("A", "Docente Excelente");
    const b = await mk("B", "Docente Poucos Votos");
    turmaA = a.turma; tdA = a.td; turmaB = b.turma; tdB = b.td;
    const [u] = await sql`INSERT INTO utilizadores (nome_completo, identificador, password_hash, role, turma_id)
                          VALUES ('Del', 'del', 'x', 'DELEGADO', ${turmaA}) RETURNING id`;
    autor = u.id;
    const [ci] = await sql`
      INSERT INTO ciclos_avaliacao (titulo, semestre_letivo, data_inicio, data_fim, estado, criado_por)
      VALUES ('Ciclo', '2026-S2', NOW() - interval '1 day', NOW() + interval '7 days', 'ATIVO', ${autor}) RETURNING id`;
    cicloId = ci.id;

    // Turma A: 5 votos (média 4,6) · Turma B: 3 votos (abaixo de k)
    for (const [i, nota] of [5, 5, 5, 4, 4].entries()) await votar(turmaA, `A000${i}`, nota, `Comentário ${i}`);
    for (const [i, nota] of [1, 2, 1].entries()) await votar(turmaB, `B000${i}`, nota, `Segredo ${i}`);
  });
  after(async () => fechar());

  const F = () => ({ cicloId });

  it("T5: com 5 votos mostra a média; com 3 oculta médias e classificação", async () => {
    const r = await rankingDocentes(sql, F());
    const a = r.find((x) => x.turmaDocenteId === tdA)!;
    const b = r.find((x) => x.turmaDocenteId === tdB)!;
    assert.equal(a.votos, 5);
    assert.equal(a.visivel, true);
    assert.ok(Math.abs(a.idd! - 4.6) < 1e-6, `idd=${a.idd}`);
    assert.equal(a.classe, "DESTAQUE");

    assert.equal(b.votos, 3);
    assert.equal(b.visivel, false);
    for (const k of ["idd", "didatica", "avaliacao", "pontualidade", "comunicacao", "classe"] as const) {
      assert.equal(b[k], null, k);
    }
  });

  it("o SQL e a função pura dão o mesmo IDD", async () => {
    const notas = [5, 5, 5, 4, 4].map((n) => ({ didatica: n, avaliacao: n, pontualidade: n, comunicacao: n }));
    const r = (await rankingDocentes(sql, F())).find((x) => x.turmaDocenteId === tdA)!;
    assert.ok(Math.abs(r.idd! - calcularIDD(notas)!) < 1e-6);
  });

  it("T5: comentários só aparecem com 5 ou mais votos", async () => {
    assert.equal((await comentariosVisiveis(sql, tdA, cicloId)).length, 5);
    assert.deepEqual(await comentariosVisiveis(sql, tdB, cicloId), []);
  });

  it("o ranking não contém texto de comentários nem dados de alunos", async () => {
    const texto = JSON.stringify(await rankingDocentes(sql, F()));
    assert.ok(!texto.includes("Segredo") && !texto.includes("Comentário"));
    assert.ok(!texto.includes("B0000") && !texto.includes("A0000"));
  });

  it("a 4.ª nota baixa não pode desbloquear a turma B: 4 votos continuam ocultos", async () => {
    await votar(turmaB, "B0003", 1);
    const b = (await rankingDocentes(sql, F())).find((x) => x.turmaDocenteId === tdB)!;
    assert.equal(b.votos, 4);
    assert.equal(b.visivel, false);
    await votar(turmaB, "B0004", 1);
    const b2 = (await rankingDocentes(sql, F())).find((x) => x.turmaDocenteId === tdB)!;
    assert.equal(b2.visivel, true);
    assert.equal(b2.classe, "ALERTA");
  });

  it("filtros por faculdade, curso e turma", async () => {
    assert.equal((await rankingDocentes(sql, { cicloId, turmaId: turmaA })).length, 1);
    assert.equal((await rankingDocentes(sql, { cicloId, cursoId })).length, 2);
    assert.equal((await rankingDocentes(sql, { cicloId, faculdadeId })).length, 2);
    assert.equal((await rankingDocentes(sql, { cicloId, faculdadeId: 9999 })).length, 0);
  });

  it("KPIs: adesão global, média ponderada só dos grupos visíveis, destaques e alertas críticos", async () => {
    await registarAuditoria(sql, {
      turmaId: turmaA, autorId: autor, turmaDocenteId: null, categoria: "INFRAESTRUTURA",
      gravidade: "CRITICA", titulo: "Sala sem energia", descricao: "A sala 3 está sem energia elétrica há dois dias.",
    });
    await registarAuditoria(sql, {
      turmaId: turmaA, autorId: autor, turmaDocenteId: null, categoria: "OUTRO",
      gravidade: "BAIXA", titulo: "Quadro sujo", descricao: "O quadro da sala 3 não é limpo há vários dias.",
    });
    const k = await calcularKpis(sql, F());
    assert.equal(k.votosUnicos, 10); // 5 em A + 5 em B
    assert.equal(k.alunosEstimados, 20);
    assert.equal(k.adesaoGlobal, 50);
    assert.equal(k.docentesDestaque, 1);
    assert.equal(k.alertasCriticosAbertos, 1);
    assert.ok(Math.abs(k.mediaPedagogica! - (4.6 * 5 + 1.2 * 5) / 10) < 1e-6, String(k.mediaPedagogica));
    const fila = await alertasCriticosAbertos(sql, { cicloId, turmaId: turmaB });
    assert.equal(fila.length, 0);
  });

  it("sem votos: KPIs a zero e média nula", async () => {
    const [ci] = await sql`INSERT INTO ciclos_avaliacao (titulo, semestre_letivo, data_inicio, data_fim, estado, criado_por)
                           VALUES ('Vazio', '2026-S1', NOW(), NOW() + interval '1 day', 'ENCERRADO', ${autor}) RETURNING id`;
    const k = await calcularKpis(sql, { cicloId: ci.id });
    assert.equal(k.mediaPedagogica, null);
    assert.equal(k.docentesDestaque, 0);
    assert.equal(k.adesaoGlobal, 0);
  });
});
