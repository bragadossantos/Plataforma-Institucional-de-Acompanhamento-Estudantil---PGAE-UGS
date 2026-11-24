// Aplica db/schema.sql a uma base de dados VAZIA.
// Uso: npm run db:migrate   (lê DATABASE_URL de .env.local)
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { sslFor } from "../lib/db-ssl.ts";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL não definida.");

const sql = postgres(url, { ssl: sslFor(url), max: 1 });

try {
  const [{ existe }] = await sql`SELECT to_regclass('public.utilizadores') IS NOT NULL AS existe`;
  if (existe) {
    console.error("O esquema já existe. Esta rotina só corre em bases vazias; use uma migração em db/migrations/.");
    process.exit(1);
  }
  await sql.unsafe(readFileSync(new URL("./schema.sql", import.meta.url), "utf8"));
  console.log("Esquema aplicado.");
} finally {
  await sql.end();
}
