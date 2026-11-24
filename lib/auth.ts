import { cache } from "react";
import { cookies } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { getSql } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { verificarCredenciais } from "@/lib/login-core";
import { hashPassword, verifyPassword } from "@/lib/password";
import { isAllowed, isRole, type Role } from "@/lib/rbac";
import { signSession, verifySession } from "@/lib/session-token";

export const SESSION_COOKIE = "pgae_session";
const SESSION_TTL_S = 12 * 60 * 60;

export type SessionUser = {
  id: number;
  nome: string;
  role: Role;
  turmaId: number | null;
  mustChangePassword: boolean;
};

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET em falta ou demasiado curta (mínimo 32 caracteres).");
  return s;
}

async function setSessionCookie(uid: number, sessionVersion: number) {
  const token = signSession(
    { uid, sv: sessionVersion, exp: Date.now() + SESSION_TTL_S * 1000 },
    secret(),
  );
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_S,
  });
}

/**
 * Sessão atual, validada na base de dados em cada pedido:
 * utilizador ativo, session_version igual e conta não bloqueada.
 */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = verifySession(token, secret());
  if (!payload) return null;

  const sql = getSql();
  const [u] = await sql`
    SELECT id, nome_completo, role, turma_id, must_change_password, session_version, ativo, bloqueado_ate
    FROM utilizadores WHERE id = ${payload.uid}`;
  if (!u || !u.ativo || u.session_version !== payload.sv || !isRole(u.role)) return null;
  if (u.bloqueado_ate && new Date(u.bloqueado_ate) > new Date()) return null;

  return {
    id: u.id,
    nome: u.nome_completo,
    role: u.role,
    turmaId: u.turma_id,
    mustChangePassword: u.must_change_password,
  };
});

/**
 * Guarda obrigatória de Server Components, Server Actions e Route Handlers.
 * - sem sessão válida → /login
 * - 1.º acesso → /alterar-palavra-passe
 * - perfil não permitido → 403 e registo em audit_logs
 */
export async function requireAuth(
  allowed?: readonly Role[],
  opts?: { allowPasswordChange?: boolean },
): Promise<SessionUser> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.mustChangePassword && !opts?.allowPasswordChange) redirect("/alterar-palavra-passe");
  if (allowed && !isAllowed(s.role, allowed)) {
    await logAudit({
      actorId: s.id,
      actorRole: s.role,
      acao: "ACESSO_NEGADO",
      entidade: "rota",
      metadados: { perfisPermitidos: allowed },
    });
    forbidden();
  }
  return s;
}

/** Garante que a turma pedida é a da sessão. O servidor nunca confia num turma_id vindo do cliente. */
export async function requireTurmaScope(s: SessionUser, turmaId: number): Promise<void> {
  if (s.turmaId === null || s.turmaId !== turmaId) {
    await logAudit({
      actorId: s.id,
      actorRole: s.role,
      acao: "ACESSO_NEGADO",
      entidade: "turma",
      entidadeId: turmaId,
      metadados: { motivo: "fora_do_escopo" },
    });
    forbidden();
  }
}

export type LoginResult = { ok: true; role: Role; mustChangePassword: boolean } | { ok: false };

export async function login(identificador: string, password: string): Promise<LoginResult> {
  const r = await verificarCredenciais(getSql(), identificador, password, logAudit);
  if (!r.ok) return { ok: false };
  await setSessionCookie(r.id, r.sessionVersion);
  return { ok: true, role: r.role, mustChangePassword: r.mustChangePassword };
}

export async function logout(): Promise<void> {
  const s = await getSession();
  (await cookies()).delete(SESSION_COOKIE);
  if (s) await logAudit({ actorId: s.id, actorRole: s.role, acao: "LOGOUT", entidade: "utilizador", entidadeId: s.id });
}

/**
 * Troca a palavra-passe. Incrementa session_version (revoga as outras sessões)
 * e emite um novo cookie para a sessão atual.
 */
export async function changePassword(s: SessionUser, atual: string, nova: string): Promise<boolean> {
  const sql = getSql();
  const [u] = await sql`SELECT password_hash FROM utilizadores WHERE id = ${s.id}`;
  if (!u || !(await verifyPassword(atual, u.password_hash))) return false;

  const hash = await hashPassword(nova);
  const [r] = await sql`
    UPDATE utilizadores
    SET password_hash = ${hash}, must_change_password = FALSE, session_version = session_version + 1
    WHERE id = ${s.id}
    RETURNING session_version`;
  await setSessionCookie(s.id, r.session_version);
  await logAudit({ actorId: s.id, actorRole: s.role, acao: "PASSWORD_ALTERADA", entidade: "utilizador", entidadeId: s.id });
  return true;
}
