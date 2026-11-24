import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import type postgres from "postgres";
import { iniciarBd } from "./helpers/bd.ts";
import { calcularNullifier, idEstudanteValido, normalizarIdEstudante } from "../lib/crypto-vote.ts";
import { criarCurso, criarFaculdade, criarTurma, associarDocente, criarDocente } from "../lib/estrutura-core.ts";
import { docentesDaTurma, jaVotou, resolverCodigo, submeterVoto, type NotasDocente } from "../lib/vote-core.ts";
import { consumir, excedido, registar, LIMITE_CODIGO_ERRADO } from "../lib/rate-limit.ts";

const PEPPER = "p".repeat(64);

describe("nullifier e normalização", () => {
  it("variações de maiúsculas, espaços e separadores dão o mesmo identificador (T3)", () => {
    const base = normalizarIdEstudante("UGS20240001");
    for (const v of ["ugs20240001", " UGS 2024 0001 ", "ugs-2024-0001", "Ugs.2024.0001", "ＵＧＳ20240001"]) {
      assert.equal(normalizarIdEstudante(v), base, v);
    }
  });

  it("valida o formato do identificador", () => {
    assert.equal(idEstudanteValido("UGS20240001"), true);
    assert.equal(idEstudanteValido("AB"), false);
    assert.equal(idEstudanteValido("<SCRIPT>"), false);
    assert.equal(idEstudanteValido("A".repeat(21)), false);
  });

  it("o nullifier é determinístico, tem 64 hex e muda com docente, ciclo e pepper", () => {
    const n = calcularNullifier(PEPPER, "ABC123", 1, 1);
    assert.match(n, /^[0-9a-f]{64}$/);
    assert.equal(n, calcularNullifier(PEPPER, "ABC123", 1, 1));
    assert.notEqual(n, calcularNullifier(PEPPER, "ABC123", 2, 1));
    assert.notEqual(n, calcularNullifier(PEPPER, "ABC123", 1, 2));
    assert.notEqual(n, calcularNullifier(PEPPER, "ABC124", 1, 1));
    assert.notEqual(n, calcularNullifier("q".repeat(64), "ABC123", 1, 1));
  });

  it("recusa um pepper curto", () => {
    assert.throws(() => calcularNullifier("curto", "ABC123", 1, 1));
  });
});

describe("votação anónima", () => {
  let sql: postgres.Sql;
  let fechar: () => Promise<void>;
  let turmaId = 0;
  let cicloId = 0;
  let codigo = "";
  let tds: number[] = [];

  const notas = (nota = 4): NotasDocente[] =>
    tds.map((id) => ({
      turmaDocenteId: id,
      didatica: nota,
      avaliacao: nota,
      pontualidade: nota,
      comunicacao: nota,
      comentario: null,
    }));
  const voto = (idEstudante: string, n = notas()) =>
    submeterVoto(sql, { turmaId, cicloId, idEstudante, notas: n }, PEPPER);
  const contagem = async (tabela: "votos_controlo" | "votos_docentes") =>
    (await sql`SELECT COUNT(*)::int AS n FROM ${sql(tabela)}`)[0].n as number;

  before(async () => {
    const bd = await iniciarBd();
    sql = bd.sql;
    fechar = bd.fechar;
    const f = (await criarFaculdade(sql, { nome: "FENT", sigla: "FENT" })) as { id: number };
    const c = (await criarCurso(sql, { faculdadeId: f.id, nome: "Eng. Informática", codigo: "EI" })) as { id: number };
    const t = await criarTurma(sql, {
      cursoId: c.id, ano: 3, designacao: "A", periodo: "MANHA", semestre: "2026-S2", totalEstimado: 40,
    });
    if (!t.ok) throw new Error(t.erro);
    turmaId = t.id;
    codigo = t.extra!;
    for (const [i, disc] of ["Algoritmos", "Redes", "Bases de Dados"].entries()) {
      const d = (await criarDocente(sql, { nome: `Docente ${i}`, codigo: null, grau: null })) as { id: number };
      await associarDocente(sql, { turmaId, docenteId: d.id, disciplina: disc });
    }
    tds = (await docentesDaTurma(sql, turmaId)).map((x) => x.id);
    const [adm] = await sql`
      INSERT INTO utilizadores (nome_completo, identificador, password_hash, role)
      VALUES ('Admin', 'admin', 'x', 'GAE_ADMIN') RETURNING id`;
    const [ci] = await sql`
      INSERT INTO ciclos_avaliacao (titulo, semestre_letivo, data_inicio, data_fim, estado, criado_por)
      VALUES ('Ciclo 1', '2026-S2', NOW() - interval '1 day', NOW() + interval '7 days', 'ATIVO', ${adm.id})
      RETURNING id`;
    cicloId = ci.id;
  });
  after(async () => fechar());

  it("o código da turma resolve para a turma e o ciclo ativo; código errado ou rascunho não", async () => {
    const r = await resolverCodigo(sql, `  ${codigo.toLowerCase()} `);
    assert.deepEqual(r && { t: r.turmaId, c: r.cicloId }, { t: turmaId, c: cicloId });
    assert.equal(await resolverCodigo(sql, "EI3A-ZZZZ"), null);
    assert.equal(await resolverCodigo(sql, "'; DROP TABLE turmas;--"), null);
    await sql`UPDATE ciclos_avaliacao SET estado = 'RASCUNHO' WHERE id = ${cicloId}`;
    assert.equal(await resolverCodigo(sql, codigo), null);
    await sql`UPDATE ciclos_avaliacao SET estado = 'ATIVO' WHERE id = ${cicloId}`;
  });

  it("regista 1 nullifier e 1 voto por docente numa só transação", async () => {
    const r = await voto("UGS20240001");
    assert.deepEqual(r, { ok: true });
    assert.equal(await contagem("votos_controlo"), 3);
    assert.equal(await contagem("votos_docentes"), 3);
    assert.equal(await jaVotou(sql, { turmaId, cicloId, idEstudante: "ugs-2024-0001" }, PEPPER), true);
    assert.equal(await jaVotou(sql, { turmaId, cicloId, idEstudante: "OUTRO999" }, PEPPER), false);
  });

  it("T3: o mesmo aluno com outras maiúsculas/espaços é bloqueado e nada é gravado", async () => {
    for (const v of ["ugs20240001", " UGS 2024 0001 ", "ugs-2024-0001"]) {
      const r = await voto(v);
      assert.equal(r.ok, false);
      if (!r.ok) assert.equal(r.motivo, "DUPLICADO");
    }
    assert.equal(await contagem("votos_controlo"), 3);
    assert.equal(await contagem("votos_docentes"), 3);
  });

  it("um segundo aluno vota normalmente", async () => {
    assert.deepEqual(await voto("UGS20240002", notas(5)), { ok: true });
    assert.equal(await contagem("votos_docentes"), 6);
  });

  it("dois pedidos simultâneos do mesmo aluno: exatamente um passa", async () => {
    const rs = await Promise.all([voto("UGS20240003"), voto("UGS20240003")]);
    assert.equal(rs.filter((r) => r.ok).length, 1);
    assert.equal(await contagem("votos_docentes"), 9);
  });

  it("T4: votos_docentes não contém identificador, hash, hora exata nem ligação aos controlos", async () => {
    const rows = await sql`SELECT * FROM votos_docentes`;
    const texto = JSON.stringify(rows);
    for (const id of ["UGS20240001", "UGS20240002", "UGS20240003"]) assert.ok(!texto.includes(id));
    const hashes = await sql`SELECT nullifier_hash FROM votos_controlo`;
    for (const h of hashes) assert.ok(!texto.includes(h.nullifier_hash));
    const datas = await sql`SELECT DISTINCT data_registo::text AS d, pg_typeof(data_registo)::text AS t FROM votos_docentes`;
    assert.equal(datas.length, 1);
    assert.equal(datas[0].t, "date");
    const [{ n }] = await sql`SELECT COUNT(DISTINCT id)::int AS n FROM votos_docentes`;
    assert.equal(n, 9);
    // O controlo não tem notas nem referência ao voto.
    const [c] = await sql`SELECT * FROM votos_controlo LIMIT 1`;
    assert.deepEqual(Object.keys(c).sort(), ["ciclo_id", "id", "nullifier_hash", "turma_docente_id"]);
  });

  it("recusa votos incompletos, notas fora de 1–5, docente alheio e identificador inválido", async () => {
    const incompleto = await voto("UGS20240010", notas().slice(1));
    assert.equal(incompleto.ok, false);
    const fora = await voto("UGS20240010", notas(6));
    assert.equal(fora.ok, false);
    const alheio = await voto("UGS20240010", [...notas().slice(1), { ...notas()[0], turmaDocenteId: 99999 }]);
    assert.equal(alheio.ok, false);
    const repetido = await voto("UGS20240010", [...notas(), notas()[0]]);
    assert.equal(repetido.ok, false);
    const invalido = await voto("<b>");
    assert.equal(invalido.ok, false);
    assert.equal(await contagem("votos_docentes"), 9);
  });

  it("ciclo encerrado não aceita votos", async () => {
    await sql`UPDATE ciclos_avaliacao SET estado = 'ENCERRADO' WHERE id = ${cicloId}`;
    const r = await voto("UGS20240020");
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.motivo, "CICLO_FECHADO");
    await sql`UPDATE ciclos_avaliacao SET estado = 'ATIVO' WHERE id = ${cicloId}`;
  });

  it("a inquietação opcional é gravada sem qualquer dado do aluno", async () => {
    const r = await submeterVoto(
      sql,
      {
        turmaId, cicloId, idEstudante: "UGS20240030", notas: notas(3),
        inquietacao: { categoria: "LABORATORIOS", descricao: "Horários dos laboratórios pouco claros" },
      },
      PEPPER,
    );
    assert.deepEqual(r, { ok: true });
    const [i] = await sql`SELECT * FROM inquietacoes_estudantis`;
    assert.equal(i.categoria, "LABORATORIOS");
    assert.ok(!JSON.stringify(i).includes("UGS20240030"));
    assert.equal(i.visivel_fentfest, false);
  });
});

describe("rate limiting", () => {
  let sql: postgres.Sql;
  let fechar: () => Promise<void>;
  before(async () => {
    const bd = await iniciarBd();
    sql = bd.sql;
    fechar = bd.fechar;
  });
  after(async () => fechar());

  it("permite até ao máximo e bloqueia a seguir; chaves diferentes são independentes", async () => {
    const lim = { max: 3, janelaSeg: 600 };
    for (let i = 0; i < 3; i++) assert.equal((await consumir(sql, "voto:a", lim)).permitido, true);
    assert.equal((await consumir(sql, "voto:a", lim)).permitido, false);
    assert.equal((await consumir(sql, "voto:b", lim)).permitido, true);
  });

  it("5 códigos errados por IP esgotam o limite rígido", async () => {
    const chave = "codigo:ip1";
    for (let i = 0; i < 4; i++) {
      await registar(sql, chave, LIMITE_CODIGO_ERRADO.janelaSeg);
      assert.equal(await excedido(sql, chave, LIMITE_CODIGO_ERRADO), false);
    }
    await registar(sql, chave, LIMITE_CODIGO_ERRADO.janelaSeg);
    assert.equal(await excedido(sql, chave, LIMITE_CODIGO_ERRADO), true);
    assert.equal(await excedido(sql, "codigo:ip2", LIMITE_CODIGO_ERRADO), false);
  });
});
