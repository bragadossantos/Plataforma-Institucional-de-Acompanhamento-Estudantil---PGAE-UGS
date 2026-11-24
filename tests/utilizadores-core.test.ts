import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import type postgres from "postgres";
import { iniciarBd } from "./helpers/bd.ts";
import { verificarCredenciais } from "../lib/login-core.ts";
import { criarCurso, criarFaculdade, criarTurma } from "../lib/estrutura-core.ts";
import {
  alternarAtivo,
  criarUtilizador,
  gerarPasswordProvisoria,
  redefinirPassword,
} from "../lib/utilizadores-core.ts";
import { novaPasswordSchema } from "../lib/validators.ts";

let sql: postgres.Sql;
let fechar: () => Promise<void>;
let turmaId = 0;
let adminId = 0;
const semAudit = async () => {};

describe("palavra-passe provisória", () => {
  it("cumpre a política (≥ 8, letras e números) e é diferente de cada vez", () => {
    const vistas = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const p = gerarPasswordProvisoria();
      assert.equal(p.length, 12);
      assert.equal(novaPasswordSchema.safeParse(p).success, true, p);
      vistas.add(p);
    }
    assert.equal(vistas.size, 100);
  });
});

describe("gestão de utilizadores", () => {
  before(async () => {
    const bd = await iniciarBd();
    sql = bd.sql;
    fechar = bd.fechar;
    const f = await criarFaculdade(sql, { nome: "FENT", sigla: "FENT" });
    const c = await criarCurso(sql, { faculdadeId: (f as { id: number }).id, nome: "Eng. Informática", codigo: "EI" });
    const t = await criarTurma(sql, {
      cursoId: (c as { id: number }).id,
      ano: 3,
      designacao: "A",
      periodo: "MANHA",
      semestre: "2026-S2",
      totalEstimado: 40,
    });
    turmaId = (t as { id: number }).id;
    const [a] = await sql`
      INSERT INTO utilizadores (nome_completo, identificador, password_hash, role)
      VALUES ('Admin', 'admin', 'x', 'GAE_ADMIN') RETURNING id`;
    adminId = a.id;
  });
  after(async () => fechar());

  it("cria o Delegado com palavra-passe provisória que permite entrar e obriga a trocar", async () => {
    const r = await criarUtilizador(
      sql,
      { nome: "Delegado A", identificador: "  Del.A@UGS.local ", role: "DELEGADO", turmaId },
      adminId,
    );
    assert.equal(r.ok, true);
    if (!r.ok) return;
    const login = await verificarCredenciais(sql, "del.a@ugs.local", r.senha!, semAudit);
    assert.equal(login.ok, true);
    if (login.ok) {
      assert.equal(login.role, "DELEGADO");
      assert.equal(login.mustChangePassword, true);
    }
    const [u] = await sql`SELECT criado_por, password_hash FROM utilizadores WHERE id = ${r.id}`;
    assert.equal(u.criado_por, adminId);
    assert.ok(!u.password_hash.includes(r.senha!), "a palavra-passe não pode ficar em claro");
  });

  it("Dia 1: bloqueia um 2.º Delegado ativo na mesma turma, mas aceita Subdelegado e Secretário", async () => {
    const dup = await criarUtilizador(sql, { nome: "Delegado B", identificador: "del.b", role: "DELEGADO", turmaId }, adminId);
    assert.equal(dup.ok, false);
    if (!dup.ok) assert.match(dup.erro, /já tem um Delegado ativo/);
    assert.equal(
      (await criarUtilizador(sql, { nome: "Sub", identificador: "sub.a", role: "SUBDELEGADO", turmaId }, adminId)).ok,
      true,
    );
    assert.equal(
      (await criarUtilizador(sql, { nome: "Sec", identificador: "sec.a", role: "SECRETARIO", turmaId }, adminId)).ok,
      true,
    );
  });

  it("T7: a turma fica com exatamente 3 cargos de liderança ativos", async () => {
    const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM utilizadores WHERE turma_id = ${turmaId} AND ativo`;
    assert.equal(n, 3);
  });

  it("cargo de turma exige turma; perfis GAE/FENT não podem ter turma; identificador único", async () => {
    const tenta = (identificador: string, role: "DELEGADO" | "GAE_ANALISTA" | "FENT_OBSERVER", t: number | null) =>
      criarUtilizador(sql, { nome: "X", identificador, role, turmaId: t }, adminId);
    assert.equal((await tenta("x1", "DELEGADO", null)).ok, false);
    assert.equal((await tenta("x2", "GAE_ANALISTA", turmaId)).ok, false);
    assert.equal((await tenta("x3", "DELEGADO", 9999)).ok, false);
    assert.equal((await tenta("obs", "FENT_OBSERVER", null)).ok, true);
    const rep = await tenta("OBS", "FENT_OBSERVER", null);
    assert.equal(rep.ok, false);
    if (!rep.ok) assert.match(rep.erro, /identificador/);
  });

  it("T8: desativar revoga as sessões (session_version) e impede o login", async () => {
    const [d] = await sql`SELECT id, session_version FROM utilizadores WHERE identificador = 'del.a@ugs.local'`;
    const r = await alternarAtivo(sql, d.id, adminId);
    assert.deepEqual(r, { ok: true, id: d.id, ativo: false });
    const [depois] = await sql`SELECT session_version FROM utilizadores WHERE id = ${d.id}`;
    assert.equal(depois.session_version, d.session_version + 1);
    assert.equal((await redefinirPassword(sql, d.id)).ok, false);
  });

  it("depois de desativar o Delegado, pode criar outro; reativar o antigo é recusado", async () => {
    const novo = await criarUtilizador(sql, { nome: "Delegado B", identificador: "del.b", role: "DELEGADO", turmaId }, adminId);
    assert.equal(novo.ok, true);
    const [antigo] = await sql`SELECT id FROM utilizadores WHERE identificador = 'del.a@ugs.local'`;
    const re = await alternarAtivo(sql, antigo.id, adminId);
    assert.equal(re.ok, false);
    if (!re.ok) assert.match(re.erro, /já tem um Delegado ativo/);
  });

  it("ninguém desativa a própria conta nem o último administrador ativo", async () => {
    assert.equal((await alternarAtivo(sql, adminId, adminId)).ok, false);
    const [outro] = await sql`
      INSERT INTO utilizadores (nome_completo, identificador, password_hash, role)
      VALUES ('Admin 2', 'admin2', 'x', 'GAE_ADMIN') RETURNING id`;
    assert.equal((await alternarAtivo(sql, adminId, outro.id)).ok, true);
    const bloqueado = await alternarAtivo(sql, outro.id, adminId);
    assert.equal(bloqueado.ok, false);
    if (!bloqueado.ok) assert.match(bloqueado.erro, /pelo menos um administrador/);
  });

  it("redefinir palavra-passe desbloqueia, revoga sessões e obriga a nova troca", async () => {
    const [s] = await sql`SELECT id, session_version FROM utilizadores WHERE identificador = 'sub.a'`;
    await sql`UPDATE utilizadores
              SET must_change_password = FALSE, tentativas_falhadas = 5, bloqueado_ate = NOW() + interval '10 minutes'
              WHERE id = ${s.id}`;
    const r = await redefinirPassword(sql, s.id);
    assert.equal(r.ok, true);
    if (!r.ok) return;
    const [u] = await sql`
      SELECT must_change_password, tentativas_falhadas, bloqueado_ate, session_version
      FROM utilizadores WHERE id = ${s.id}`;
    assert.equal(u.must_change_password, true);
    assert.equal(u.tentativas_falhadas, 0);
    assert.equal(u.bloqueado_ate, null);
    assert.equal(u.session_version, s.session_version + 1);
    assert.equal((await verificarCredenciais(sql, "sub.a", r.senha!, semAudit)).ok, true);
  });
});
