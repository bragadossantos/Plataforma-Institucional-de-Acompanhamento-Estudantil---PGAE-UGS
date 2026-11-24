import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import postgres from "postgres";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

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

/** Postgres real (PGlite) com o esquema aplicado, acessível por postgres.js. */
export async function iniciarBd() {
  const port = await portaLivre();
  const db = await PGlite.create();
  await db.exec(readFileSync(new URL("../../db/schema.sql", import.meta.url), "utf8"));
  const server = new PGLiteSocketServer({ db, port, host: "127.0.0.1", maxConnections: 5 });
  await server.start();
  const sql = postgres(`postgres://postgres:postgres@127.0.0.1:${port}/postgres`, { ssl: false, max: 1 });
  return {
    sql,
    async fechar() {
      await sql.end();
      await server.stop();
      await db.close();
    },
  };
}
