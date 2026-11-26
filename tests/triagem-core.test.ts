import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import type postgres from "postgres";
import { iniciarBd } from "./helpers/bd.ts";
import { associarDocente, criarCurso, criarDocente, criarFaculdade, criarTurma } from "../lib/estrutura-core.ts";
import { registarAuditoria } from "../lib/auditoria-core.ts";
import { alterarEstado, definirFentFest, definirInquietacaoVisivel, resumoSeguro, transicoesPermitidas } from "../lib/triagem-core.ts";

describe("resumo impessoal", () => {
  it("aceita um texto sem nomes", () => {
    assert.equal(resumoSeguro("Dificuldade na consulta de horários dos laboratórios", ["Maria Gomes"]).ok, true);
  });

  it("recusa nomes de pessoas, mesmo sem acentos ou em maiúsculas, mas não partículas", () => {
    assert.equal(resumoSeguro("O professor Antonio Gonçalves falta muito", ["António Gonçalves"]).ok, false);
    assert.equal(resumoSeguro("A aula do GONCALVES não começou", ["António Gonçalves"]).ok, false);
    assert.equal(resumoSeguro("Problema de comunicação da Maria com a turma", ["Maria da Silva"]).ok, false);
    // "da" é partícula: não deve bloquear
    assert.equal(resumoSeguro("Falta de material da sala de laboratório", ["Maria da Silva"]).ok, true);
  });

  it("recusa contactos, ligações, números longos e tamanhos fora dos limites", () => {
    for (const t of ["Contactar joao@ugs.ao sobre o caso", "Ver https://exemplo.com/caso", "Aluno 20240012345 reclamou"]) {
      assert.equal(resumoSeguro(t, []).ok, false, t);
    }
    assert.equal(resumoSeguro("curto", []).ok, false);
    assert.equal(resumoSeguro("x".repeat(301), []).ok, false);
  });
});

describe("estados", () => {
  it("fluxo permitido: NOVO → EM_ANALISE → ENCAMINHADO → RESOLVIDO; ARQUIVADO é final", () => {
    assert.deepEqual([...transicoesPermitidas("NOVO")], ["EM_ANALISE", "ARQUIVADO"]);
    assert.ok(transicoesPermitidas("EM_ANALISE").includes("ENCAMINHADO_DIRECAO"));
    assert.deepEqual([...transicoesPermitidas("ARQUIVADO")], []);
    assert.ok(!transicoesPermitidas("NOVO").includes("RESOLVIDO"));
  });
});

describe("triagem na base de dados", () => {
  let sql: postgres.Sql;
  let fechar: () => Promise<void>;
  let ocorrencia = 0;
  let geral = 0;

  before(async () => {
    const bd = await iniciarBd();
    sql = bd.sql;
    fechar = bd.fechar;
    const f = (await criarFaculdade(sql, { nome: "FENT", sigla: "FENT" })) as { id: number };
    const c = (await criarCurso(sql, { faculdadeId: f.id, nome: "Eng. Informática", codigo: "EI" })) as { id: number };
    const t = await criarTurma(sql, { cursoId: c.id, ano: 3, designacao: "A", periodo: "MANHA", semestre: "2026-S2", totalEstimado: 40 });
    if (!t.ok) throw new Error(t.erro);
    const d = (await criarDocente(sql, { nome: "Carlos Mateus", codigo: null, grau: null })) as { id: number };
    const td = (await associarDocente(sql, { turmaId: t.id, docenteId: d.id, disciplina: "Redes" })) as { id: number };
    const [u] = await sql`INSERT INTO utilizadores (nome_completo, identificador, password_hash, role, turma_id)
                          VALUES ('Beatriz Lopes', 'del', 'x', 'DELEGADO', ${t.id}) RETURNING id`;
    const base = { turmaId: t.id, autorId: u.id, categoria: "DIDATICA" as const, gravidade: "ALTA" as const };
    const r1 = await registarAuditoria(sql, { ...base, turmaDocenteId: td.id, titulo: "Aulas por dar", descricao: "O docente não lecionou três aulas seguidas." });
    const r2 = await registarAuditoria(sql, { ...base, turmaDocenteId: null, titulo: "Sala sem luz", descricao: "A sala 3 está sem luz há dois dias seguidos." });
    ocorrencia = (r1 as { id: number }).id;
    geral = (r2 as { id: number }).id;
  });
  after(async () => fechar());

  it("segue o fluxo, guarda o parecer e recusa saltos e estados finais", async () => {
    assert.equal((await alterarEstado(sql, ocorrencia, "RESOLVIDO", null)).ok, false); // NOVO → RESOLVIDO não existe
    assert.equal((await alterarEstado(sql, ocorrencia, "EM_ANALISE", "A analisar com o decanato")).ok, true);
    assert.equal((await alterarEstado(sql, ocorrencia, "ENCAMINHADO_DIRECAO", null)).ok, true);
    assert.equal((await alterarEstado(sql, ocorrencia, "RESOLVIDO", "Aulas repostas")).ok, true);
    const [a] = await sql`SELECT estado, parecer_gae FROM auditorias_sala WHERE id = ${ocorrencia}`;
    assert.equal(a.estado, "RESOLVIDO");
    assert.equal(a.parecer_gae, "Aulas repostas");
    assert.equal((await alterarEstado(sql, ocorrencia, "ARQUIVADO", null)).ok, true);
    assert.equal((await alterarEstado(sql, ocorrencia, "EM_ANALISE", null)).ok, false); // final
    assert.equal((await alterarEstado(sql, 99999, "EM_ANALISE", null)).ok, false);
  });

  it("não deixa enviar para o Banco de Desafios com o nome do docente ou de quem registou", async () => {
    const comDocente = await definirFentFest(sql, ocorrencia, true, "O professor Mateus falta às aulas de redes");
    assert.equal(comDocente.ok, false);
    const comAutor = await definirFentFest(sql, ocorrencia, true, "Relato da Beatriz sobre aulas em falta");
    assert.equal(comAutor.ok, false);
    const [a] = await sql`SELECT elegivel_fentfest FROM auditorias_sala WHERE id = ${ocorrencia}`;
    assert.equal(a.elegivel_fentfest, false);
  });

  it("com resumo impessoal, liga e desliga o envio", async () => {
    const r = await definirFentFest(sql, ocorrencia, true, "Aulas de uma disciplina de redes não foram lecionadas durante semanas");
    assert.equal(r.ok, true);
    const [a] = await sql`SELECT elegivel_fentfest, resumo_anonimizado_fentfest FROM auditorias_sala WHERE id = ${ocorrencia}`;
    assert.equal(a.elegivel_fentfest, true);
    assert.match(a.resumo_anonimizado_fentfest, /redes/);
    assert.equal((await definirFentFest(sql, ocorrencia, false, null)).ok, true);
    const [b] = await sql`SELECT elegivel_fentfest FROM auditorias_sala WHERE id = ${ocorrencia}`;
    assert.equal(b.elegivel_fentfest, false);
  });

  it("ocorrência geral (sem docente) também verifica o nome de quem registou", async () => {
    assert.equal((await definirFentFest(sql, geral, true, "Pedido da Lopes para reparar a iluminação")).ok, false);
    assert.equal((await definirFentFest(sql, geral, true, "Salas sem iluminação durante vários dias")).ok, true);
  });

  it("curadoria das inquietações: aprovar e retirar", async () => {
    const [t] = await sql`SELECT id FROM turmas LIMIT 1`;
    const [i] = await sql`INSERT INTO inquietacoes_estudantis (turma_id, categoria, descricao)
                          VALUES (${t.id}, 'TECNOLOGIA', 'Wi-Fi fraco nas salas') RETURNING id, visivel_fentfest`;
    assert.equal(i.visivel_fentfest, false);
    assert.equal((await definirInquietacaoVisivel(sql, i.id, true)).ok, true);
    const [a] = await sql`SELECT visivel_fentfest FROM inquietacoes_estudantis WHERE id = ${i.id}`;
    assert.equal(a.visivel_fentfest, true);
    assert.equal((await definirInquietacaoVisivel(sql, i.id, false)).ok, true);
    assert.equal((await definirInquietacaoVisivel(sql, 99999, true)).ok, false);
  });
});
