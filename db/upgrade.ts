// Aplica db/migrations/*.sql (idempotentes) a uma base existente.
// Uso: npm run db:upgrade   (lê DATABASE_URL de .env.local)
import { readdirSync, readFileSync } from "node:fs";
import postgres from "postgres";
import { sslFor } from "../lib/db-ssl.ts";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL não definida.");

const sql = postgres(url, { ssl: sslFor(url), max: 1 });
try {
  const pasta = new URL("./migrations/", import.meta.url);
  for (const f of readdirSync(pasta).filter((n) => n.endsWith(".sql")).sort()) {
    await sql.unsafe(readFileSync(new URL(f, pasta), "utf8"));
    console.log("Aplicada:", f);
  }
} finally {
  await sql.end();
}
