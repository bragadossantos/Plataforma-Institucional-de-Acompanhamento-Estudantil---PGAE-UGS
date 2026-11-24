import { readFileSync } from "node:fs";
import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";

const schema = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");
let db: PGlite;

async function rejects(sql: string, params: unknown[] = []) {
  await assert.rejects(() => db.query(sql, params));
}

const novaTurma = `INSERT INTO turmas (curso_id, ano_curricular, designacao, periodo, semestre_letivo, codigo_acesso)`;
const novoVoto = `INSERT INTO votos_docentes (ciclo_id, turma_docente_id, nota_didatica, nota_avaliacao, nota_pontualidade, nota_comunicacao)`;

describe("esquema PostgreSQL", () => {
  before(async () => {
    db = new PGlite();
    await db.exec(schema);
    await db.exec(`
      INSERT INTO faculdades (nome, sigla) VALUES ('FENT', 'FENT');
      INSERT INTO cursos (faculdade_id, nome, codigo) VALUES (1, 'Eng. Informatica', 'EI');
    `);
  });

  it("aceita as turmas A a D e rejeita a 5.ª (E) no mesmo curso/ano", async () => {
    let n = 0;
    for (const d of ["A", "B", "C", "D"]) {
      await db.query(`${novaTurma} VALUES (1, 3, $1, 'MANHA', '2026-S2', $2)`, [d, `EI3${d}-CODE${++n}`]);
    }
    await rejects(`${novaTurma} VALUES (1, 3, 'E', 'MANHA', '2026-S2', 'EI3E-CODE9')`);
  });

  it("rejeita designação repetida no mesmo curso/ano/semestre", async () => {
    await rejects(`${novaTurma} VALUES (1, 3, 'A', 'TARDE', '2026-S2', 'EI3A-OUTRO')`);
  });

  it("rejeita ano curricular fora de 1–5", async () => {
    await rejects(`${novaTurma} VALUES (1, 6, 'A', 'MANHA', '2026-S2', 'EI6A-CODE')`);
  });

  it("permite 1 Delegado, 1 Subdelegado e 1 Secretário e rejeita um 2.º Delegado ativo", async () => {
    const ins = (id: string, role: string) =>
      db.query(
        `INSERT INTO utilizadores (nome_completo, identificador, password_hash, role, turma_id)
         VALUES ($1, $1, 'x', $2::user_role, 1)`,
        [id, role],
      );
    await ins("del1", "DELEGADO");
    await ins("sub1", "SUBDELEGADO");
    await ins("sec1", "SECRETARIO");
    await assert.rejects(() => ins("del2", "DELEGADO"));
  });

  it("permite novo Delegado depois de desativar o anterior", async () => {
    await db.query(`UPDATE utilizadores SET ativo = FALSE WHERE identificador = 'del1'`);
    await db.query(
      `INSERT INTO utilizadores (nome_completo, identificador, password_hash, role, turma_id)
       VALUES ('del3', 'del3', 'x', 'DELEGADO', 1)`,
    );
  });

  it("liderança exige turma e perfis GAE/FENT não podem ter turma", async () => {
    await rejects(
      `INSERT INTO utilizadores (nome_completo, identificador, password_hash, role)
       VALUES ('sem-turma', 'sem-turma', 'x', 'DELEGADO')`,
    );
    await rejects(
      `INSERT INTO utilizadores (nome_completo, identificador, password_hash, role, turma_id)
       VALUES ('gae-turma', 'gae-turma', 'x', 'GAE_ADMIN', 1)`,
    );
  });

  it("must_change_password é verdadeiro por defeito", async () => {
    await db.query(
      `INSERT INTO utilizadores (nome_completo, identificador, password_hash, role)
       VALUES ('admin', 'admin', 'x', 'GAE_ADMIN')`,
    );
    const r = await db.query<{ must_change_password: boolean }>(
      `SELECT must_change_password FROM utilizadores WHERE identificador = 'admin'`,
    );
    assert.equal(r.rows[0].must_change_password, true);
  });

  it("notas de voto fora de 1–5 são rejeitadas", async () => {
    await db.exec(`
      INSERT INTO utilizadores (nome_completo, identificador, password_hash, role)
        VALUES ('criador', 'criador', 'x', 'GAE_ANALISTA');
      INSERT INTO docentes (nome_completo) VALUES ('Docente Teste');
      INSERT INTO turma_docentes (turma_id, docente_id, disciplina) VALUES (1, 1, 'Algoritmos');
      INSERT INTO ciclos_avaliacao (titulo, semestre_letivo, data_inicio, data_fim, criado_por)
        VALUES ('Ciclo', '2026-S2', NOW(), NOW() + interval '7 days',
                (SELECT id FROM utilizadores WHERE identificador = 'criador'));
    `);
    await rejects(`${novoVoto} VALUES (1, 1, 6, 3, 3, 3)`);
    await db.query(`${novoVoto} VALUES (1, 1, 5, 4, 3, 2)`);
  });

  it("nullifier duplicado é rejeitado em votos_controlo", async () => {
    const h = "a".repeat(64);
    const q = `INSERT INTO votos_controlo (ciclo_id, turma_docente_id, nullifier_hash) VALUES (1, 1, $1)`;
    await db.query(q, [h]);
    await rejects(q, [h]);
  });

  it("anonimato: votos_docentes sem identificadores e sem ligação a votos_controlo", async () => {
    const cols = await db.query<{ column_name: string; data_type: string }>(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'votos_docentes'`,
    );
    const nomes = cols.rows.map((c) => c.column_name).sort();
    assert.deepEqual(nomes, [
      "ciclo_id",
      "comentario_curto",
      "data_registo",
      "id",
      "nota_avaliacao",
      "nota_comunicacao",
      "nota_didatica",
      "nota_pontualidade",
      "turma_docente_id",
    ]);
    assert.equal(cols.rows.find((c) => c.column_name === "data_registo")?.data_type, "date");
    assert.equal(cols.rows.find((c) => c.column_name === "id")?.data_type, "uuid");

    const fks = await db.query(
      `SELECT 1 FROM information_schema.table_constraints tc
       JOIN information_schema.constraint_column_usage ccu USING (constraint_name)
       WHERE tc.constraint_type = 'FOREIGN KEY'
         AND ((tc.table_name = 'votos_docentes' AND ccu.table_name = 'votos_controlo')
           OR (tc.table_name = 'votos_controlo' AND ccu.table_name = 'votos_docentes'))`,
    );
    assert.equal(fks.rows.length, 0);

    const ctrl = await db.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'votos_controlo'`,
    );
    assert.ok(!ctrl.rows.some((c) => c.column_name.startsWith("nota_")));
  });
});
