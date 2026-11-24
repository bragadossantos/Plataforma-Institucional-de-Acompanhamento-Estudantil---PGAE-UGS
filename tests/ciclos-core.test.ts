import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import type postgres from "postgres";
import { iniciarBd } from "./helpers/bd.ts";
import { associarDocente, criarCurso, criarDocente, criarFaculdade, criarTurma } from "../lib/estrutura-core.ts";
import { abrirCiclo, alternarCodigoAtivo, criarCiclo, encerrarCiclo, rodarCodigo } from "../lib/ciclos-core.ts";
import { resolverCodigo } from "../lib/vote-core.ts";

let sql: postgres.Sql;
let fechar: () => Promise<void>;
let turmaId = 0;
let codigo = "";
let adminId = 0;

const amanha = () => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
const ontem = () => new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
const daqui = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);

describe("ciclos e códigos de turma", () => {
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
    const [a] = await sql`INSERT INTO utilizadores (nome_completo, identificador, password_hash, role)
                          VALUES ('Admin', 'admin', 'x', 'GAE_ADMIN') RETURNING id`;
    adminId = a.id;
  });
  after(async () => fechar());

  it("cria ciclo em rascunho e recusa fim anterior ao início", async () => {
    const mau = await criarCiclo(sql, { titulo: "X", semestre: "2026-S2", inicio: amanha(), fim: ontem() }, adminId);
    assert.equal(mau.ok, false);
    const r = await criarCiclo(sql, { titulo: "Ciclo 1", semestre: "2026-S2", inicio: ontem(), fim: daqui(7) }, adminId);
    assert.equal(r.ok, true);
    const [c] = await sql`SELECT estado FROM ciclos_avaliacao WHERE id = ${(r as { id: number }).id}`;
    assert.equal(c.estado, "RASCUNHO");
  });

  it("não abre ciclo sem turmas com docentes", async () => {
    const [c] = await sql`SELECT id FROM ciclos_avaliacao LIMIT 1`;
    const r = await abrirCiclo(sql, c.id);
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.erro, /turmas com docentes/);
  });

  it("abre com docentes, e só um ciclo ativo por semestre", async () => {
    const d = (await criarDocente(sql, { nome: "Docente", codigo: null, grau: null })) as { id: number };
    await associarDocente(sql, { turmaId, docenteId: d.id, disciplina: "Algoritmos" });
    const [c1] = await sql`SELECT id FROM ciclos_avaliacao LIMIT 1`;
    const aberto = await abrirCiclo(sql, c1.id);
    assert.equal(aberto.ok, true);

    const c2 = (await criarCiclo(sql, { titulo: "Ciclo 2", semestre: "2026-S2", inicio: ontem(), fim: daqui(7) }, adminId)) as { id: number };
    const dup = await abrirCiclo(sql, c2.id);
    assert.equal(dup.ok, false);
    if (!dup.ok) assert.match(dup.erro, /já existe um ciclo ativo/i);
    assert.equal((await abrirCiclo(sql, c1.id)).ok, false); // já ativo
  });

  it("com o ciclo ativo, o código de turma abre a votação", async () => {
    assert.ok(await resolverCodigo(sql, codigo));
  });

  it("rodar o código invalida o anterior de imediato e gera um novo válido (RODAR_CODIGO)", async () => {
    const r = await rodarCodigo(sql, turmaId);
    assert.equal(r.ok, true);
    const novo = (r as { extra: string }).extra;
    assert.notEqual(novo, codigo);
    assert.match(novo, /^EI3A-/);
    assert.equal(await resolverCodigo(sql, codigo), null);
    assert.ok(await resolverCodigo(sql, novo));
    codigo = novo;
  });

  it("desativar o código impede a votação; reativar repõe", async () => {
    assert.deepEqual(await alternarCodigoAtivo(sql, turmaId), { ok: true, id: turmaId, ativo: false });
    assert.equal(await resolverCodigo(sql, codigo), null);
    assert.deepEqual(await alternarCodigoAtivo(sql, turmaId), { ok: true, id: turmaId, ativo: true });
    assert.ok(await resolverCodigo(sql, codigo));
  });

  it("encerrar é definitivo e fecha a votação", async () => {
    const [c1] = await sql`SELECT id FROM ciclos_avaliacao WHERE estado = 'ATIVO'`;
    assert.equal((await encerrarCiclo(sql, c1.id)).ok, true);
    assert.equal(await resolverCodigo(sql, codigo), null);
    assert.equal((await encerrarCiclo(sql, c1.id)).ok, false);
    assert.equal((await abrirCiclo(sql, c1.id)).ok, false);
  });

  it("turma ou ciclo inexistentes devolvem erro", async () => {
    assert.equal((await rodarCodigo(sql, 9999)).ok, false);
    assert.equal((await alternarCodigoAtivo(sql, 9999)).ok, false);
    assert.equal((await abrirCiclo(sql, 9999)).ok, false);
  });
});
