import postgres from "postgres";

declare global {
  var __pgae_sql: ReturnType<typeof postgres> | undefined;
}

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não definida. Copie .env.example para .env.local.");
  // Consultas só via tagged templates (parametrizadas).
  return postgres(url, { ssl: "require", max: 5, idle_timeout: 20 });
}

/** Cliente partilhado; reutilizado entre recarregamentos em desenvolvimento. */
export function getSql() {
  if (!globalThis.__pgae_sql) globalThis.__pgae_sql = createClient();
  return globalThis.__pgae_sql;
}
