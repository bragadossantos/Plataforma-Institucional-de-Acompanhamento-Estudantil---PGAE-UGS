// Gestão de utilizadores sem dependências do Next.js (testável contra um Postgres real).
import { randomInt } from "node:crypto";
import type { Sql } from "postgres";
import { hashPassword } from "./password.ts";
import { LIDERANCA_ROLES, type Role } from "./rbac.ts";

const LETRAS = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
const DIGITOS = "23456789";

/** Palavra-passe provisória de 12 caracteres, sempre com letras e números (cumpre a política da secção 4.1). */
export function gerarPasswordProvisoria(): string {
  const todos = LETRAS + DIGITOS;
  const chars = [LETRAS[randomInt(LETRAS.length)], DIGITOS[randomInt(DIGITOS.length)]];
  while (chars.length < 12) chars.push(todos[randomInt(todos.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

export type ResultadoUtilizador =
  | { ok: true; id: number; senha?: string }
  | { ok: false; erro: string };

const CARGO_LABEL: Record<string, string> = { DELEGADO: "Delegado", SUBDELEGADO: "Subdelegado", SECRETARIO: "Secretário" };

function erroPg(e: unknown): { code?: string; constraint_name?: string } {
  return typeof e === "object" && e !== null ? (e as { code?: string; constraint_name?: string }) : {};
}

function mensagemConflito(e: unknown, role: string): string | null {
  const { code, constraint_name } = erroPg(e);
  if (code !== "23505") return null;
  if (constraint_name === "uq_cargo_lideranca_ativo_por_turma") {
    return `Esta turma já tem um ${CARGO_LABEL[role] ?? "cargo"} ativo. Desative-o primeiro.`;
  }
  return "Já existe um utilizador com esse identificador.";
}

export async function criarUtilizador(
  sql: Sql,
  d: { nome: string; identificador: string; role: Role; turmaId: number | null },
  criadoPor: number,
): Promise<ResultadoUtilizador> {
  const lideranca = LIDERANCA_ROLES.includes(d.role);
  if (lideranca && d.turmaId === null) return { ok: false, erro: "Este cargo exige uma turma." };
  if (!lideranca && d.turmaId !== null) return { ok: false, erro: "Só os cargos de turma têm turma associada." };
  if (d.turmaId !== null) {
    const [t] = await sql`SELECT 1 FROM turmas WHERE id = ${d.turmaId}`;
    if (!t) return { ok: false, erro: "Turma inválida." };
  }

  const senha = gerarPasswordProvisoria();
  const hash = await hashPassword(senha);
  try {
    const [r] = await sql`
      INSERT INTO utilizadores (nome_completo, identificador, password_hash, role, turma_id, criado_por)
      VALUES (${d.nome}, ${d.identificador.trim().toLowerCase()}, ${hash}, ${d.role}, ${d.turmaId}, ${criadoPor})
      RETURNING id`;
    return { ok: true, id: r.id, senha };
  } catch (e) {
    const m = mensagemConflito(e, d.role);
    if (m) return { ok: false, erro: m };
    throw e;
  }
}

/**
 * Ativa/desativa. Desativar incrementa session_version, o que revoga de imediato qualquer sessão aberta (T8).
 * Ninguém pode desativar a própria conta nem o último GAE_ADMIN ativo.
 */
export async function alternarAtivo(
  sql: Sql,
  id: number,
  actorId: number,
): Promise<ResultadoUtilizador & { ativo?: boolean }> {
  const [u] = await sql`SELECT id, role, ativo FROM utilizadores WHERE id = ${id}`;
  if (!u) return { ok: false, erro: "Utilizador não encontrado." };

  if (u.ativo) {
    if (u.id === actorId) return { ok: false, erro: "Não pode desativar a sua própria conta." };
    if (u.role === "GAE_ADMIN") {
      const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM utilizadores WHERE role = 'GAE_ADMIN' AND ativo`;
      if (n <= 1) return { ok: false, erro: "Tem de existir pelo menos um administrador GAE ativo." };
    }
  }

  try {
    const [r] = await sql`
      UPDATE utilizadores
      SET ativo = NOT ativo, session_version = session_version + 1, tentativas_falhadas = 0, bloqueado_ate = NULL
      WHERE id = ${id} RETURNING ativo`;
    return { ok: true, id, ativo: r.ativo };
  } catch (e) {
    const m = mensagemConflito(e, u.role);
    if (m) return { ok: false, erro: m };
    throw e;
  }
}

/** Nova palavra-passe provisória: obriga a troca no próximo acesso, desbloqueia e revoga sessões. */
export async function redefinirPassword(sql: Sql, id: number): Promise<ResultadoUtilizador> {
  const senha = gerarPasswordProvisoria();
  const hash = await hashPassword(senha);
  const [r] = await sql`
    UPDATE utilizadores
    SET password_hash = ${hash}, must_change_password = TRUE, session_version = session_version + 1,
        tentativas_falhadas = 0, bloqueado_ate = NULL
    WHERE id = ${id} AND ativo RETURNING id`;
  if (!r) return { ok: false, erro: "Utilizador não encontrado ou inativo." };
  return { ok: true, id, senha };
}
