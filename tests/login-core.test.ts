import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { hashPassword } from "../lib/password.ts";
import { verificarCredenciais } from "../lib/login-core.ts";
import type { AuditEntry } from "../lib/audit.ts";

async function portaLivre(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address() as { port: number };
      srv.close(() => resolve(port));
    });
  });
}

let PORT = 0;
let db: PGlite;
let server: PGLiteSocketServer;
let sql: postgres.Sql;
const logs: AuditEntry[] = [];
const audit = async (e: AuditEntry) => {
  logs.push(e);
};
const acoes = () => logs.map((l) => l.acao);

async function tentar(id: string, pw: string) {
  return verificarCredenciais(sql, id, pw, audit);
}

describe("credenciais, bloqueio e auditoria", () => {
  before(async () => {
    PORT = await portaLivre();
    db = await PGlite.create();
    await db.exec(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));
    server = new PGLiteSocketServer({ db, port: PORT, host: "127.0.0.1", maxConnections: 5 });
    await server.start();
    sql = postgres(`postgres://postgres:postgres@127.0.0.1:${PORT}/postgres`, { ssl: false, max: 1 });
    const hash = await hashPassword("Correta123");
    await sql`INSERT INTO utilizadores (nome_completo, identificador, password_hash, role)
              VALUES ('Admin', 'admin@ugs.local', ${hash}, 'GAE_ADMIN')`;
    await sql`INSERT INTO utilizadores (nome_completo, identificador, password_hash, role, ativo)
              VALUES ('Inativo', 'inativo@ugs.local', ${hash}, 'GAE_ANALISTA', FALSE)`;
  });

  after(async () => {
    await sql.end();
    await server.stop();
    await db.close();
  });

  it("login correto normaliza maiúsculas e espaços e devolve perfil e must_change_password", async () => {
    const r = await tentar("  ADMIN@ugs.local ", "Correta123");
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.role, "GAE_ADMIN");
      assert.equal(r.mustChangePassword, true);
    }
    assert.ok(acoes().includes("LOGIN_OK"));
  });

  it("palavra-passe errada, utilizador inexistente e inativo falham da mesma forma", async () => {
    assert.deepEqual(await tentar("admin@ugs.local", "errada111"), { ok: false });
    assert.deepEqual(await tentar("nao-existe@ugs.local", "Correta123"), { ok: false });
    assert.deepEqual(await tentar("inativo@ugs.local", "Correta123"), { ok: false });
  });

  it("5 falhas bloqueiam a conta 15 min, mesmo com a palavra-passe certa (T8/4.1.4)", async () => {
    await sql`UPDATE utilizadores SET tentativas_falhadas = 0 WHERE identificador = 'admin@ugs.local'`;
    for (let i = 0; i < 5; i++) await tentar("admin@ugs.local", "errada111");
    const [u] = await sql`SELECT tentativas_falhadas, bloqueado_ate FROM utilizadores WHERE identificador = 'admin@ugs.local'`;
    assert.equal(u.tentativas_falhadas, 5);
    const minutos = (new Date(u.bloqueado_ate).getTime() - Date.now()) / 60000;
    assert.ok(minutos > 14 && minutos <= 15, `bloqueio de ${minutos} min`);
    assert.ok(acoes().includes("CONTA_BLOQUEADA"));

    assert.deepEqual(await tentar("admin@ugs.local", "Correta123"), { ok: false });
    assert.ok(acoes().includes("LOGIN_BLOQUEADO"));
  });

  it("depois de expirar o bloqueio, o login volta a funcionar e a contagem reinicia", async () => {
    await sql`UPDATE utilizadores SET bloqueado_ate = NOW() - interval '1 minute' WHERE identificador = 'admin@ugs.local'`;
    const r = await tentar("admin@ugs.local", "Correta123");
    assert.equal(r.ok, true);
    const [u] = await sql`SELECT tentativas_falhadas, bloqueado_ate FROM utilizadores WHERE identificador = 'admin@ugs.local'`;
    assert.equal(u.tentativas_falhadas, 0);
    assert.equal(u.bloqueado_ate, null);
  });

  it("uma falha após o bloqueio expirar não bloqueia de imediato", async () => {
    await sql`UPDATE utilizadores SET tentativas_falhadas = 5, bloqueado_ate = NOW() - interval '1 minute' WHERE identificador = 'admin@ugs.local'`;
    await tentar("admin@ugs.local", "errada111");
    const [u] = await sql`SELECT tentativas_falhadas, bloqueado_ate FROM utilizadores WHERE identificador = 'admin@ugs.local'`;
    assert.equal(u.tentativas_falhadas, 1);
    assert.equal(u.bloqueado_ate, null);
  });

  it("falhas anónimas não registam identificador na auditoria", async () => {
    const anon = logs.filter((l) => l.actorRole === "ANONIMO");
    assert.ok(anon.length > 0);
    assert.ok(anon.every((l) => l.actorId === null && l.entidadeId == null));
  });
});
