// Base de dados LOCAL para desenvolvimento: PostgreSQL real (PGlite) exposto por socket.
// Uso: npm run db:local   (deixar a correr noutro terminal)
// Os dados ficam em .pglite/ (ignorado pelo Git). Nunca usar em produção.
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const PORT = Number(process.env.PGLOCAL_PORT ?? 5432);

const db = await PGlite.create("./.pglite");

const r = await db.query<{ existe: boolean }>("SELECT to_regclass('public.utilizadores') IS NOT NULL AS existe");
if (!r.rows[0].existe) {
  await db.exec(readFileSync(new URL("./schema.sql", import.meta.url), "utf8"));
  console.log("Esquema aplicado à base local.");
}

const server = new PGLiteSocketServer({ db, port: PORT, host: "127.0.0.1", maxConnections: 10 });
await server.start();
console.log(`Base local pronta em postgres://postgres:postgres@127.0.0.1:${PORT}/postgres`);

const parar = async () => {
  await server.stop();
  await db.close();
  process.exit(0);
};
process.on("SIGINT", parar);
process.on("SIGTERM", parar);
