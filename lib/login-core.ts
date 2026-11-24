// Lógica de credenciais sem dependências do Next.js (testável contra um Postgres real).
import type { Sql } from "postgres";
import type { AuditEntry } from "./audit.ts";
import { hashPassword, verifyPassword } from "./password.ts";
import { isRole, type Role } from "./rbac.ts";

export const MAX_FALHAS = 5;
export const BLOQUEIO_MIN = 15;

export type CredenciaisResult =
  | { ok: true; id: number; role: Role; sessionVersion: number; mustChangePassword: boolean }
  | { ok: false };

/** Sem espaços nas pontas e em minúsculas (igual ao seed). */
export function normalizarIdentificador(v: string): string {
  return v.trim().toLowerCase();
}

let dummyHash: Promise<string> | null = null;

export async function verificarCredenciais(
  sql: Sql,
  identificador: string,
  password: string,
  audit: (e: AuditEntry) => Promise<void>,
): Promise<CredenciaisResult> {
  const id = normalizarIdentificador(identificador);
  const [u] = await sql`
    SELECT id, password_hash, role, session_version, ativo, bloqueado_ate, must_change_password
    FROM utilizadores WHERE identificador = ${id}`;

  // Inexistente ou inativo: gasta o mesmo tempo para não revelar se a conta existe.
  if (!u || !u.ativo || !isRole(u.role)) {
    dummyHash ??= hashPassword(`dummy-${Date.now()}`);
    await verifyPassword(password, await dummyHash);
    await audit({ actorId: null, actorRole: "ANONIMO", acao: "LOGIN_FALHADO", entidade: "utilizador" });
    return { ok: false };
  }

  const role: Role = u.role;
  if (u.bloqueado_ate && new Date(u.bloqueado_ate) > new Date()) {
    await audit({ actorId: u.id, actorRole: role, acao: "LOGIN_BLOQUEADO", entidade: "utilizador", entidadeId: u.id });
    return { ok: false };
  }
  if (u.bloqueado_ate) {
    // Bloqueio expirado: recomeça a contagem.
    await sql`UPDATE utilizadores SET tentativas_falhadas = 0, bloqueado_ate = NULL WHERE id = ${u.id}`;
  }

  if (!(await verifyPassword(password, u.password_hash))) {
    const [r] = await sql`
      UPDATE utilizadores
      SET tentativas_falhadas = tentativas_falhadas + 1,
          bloqueado_ate = CASE
            WHEN tentativas_falhadas + 1 >= ${MAX_FALHAS} THEN NOW() + make_interval(mins => ${BLOQUEIO_MIN})
            ELSE NULL END
      WHERE id = ${u.id}
      RETURNING bloqueado_ate`;
    await audit({ actorId: u.id, actorRole: role, acao: "LOGIN_FALHADO", entidade: "utilizador", entidadeId: u.id });
    if (r?.bloqueado_ate) {
      await audit({
        actorId: u.id,
        actorRole: role,
        acao: "CONTA_BLOQUEADA",
        entidade: "utilizador",
        entidadeId: u.id,
        metadados: { minutos: BLOQUEIO_MIN },
      });
    }
    return { ok: false };
  }

  await sql`UPDATE utilizadores SET tentativas_falhadas = 0, bloqueado_ate = NULL WHERE id = ${u.id}`;
  await audit({ actorId: u.id, actorRole: role, acao: "LOGIN_OK", entidade: "utilizador", entidadeId: u.id });
  return { ok: true, id: u.id, role, sessionVersion: u.session_version, mustChangePassword: u.must_change_password };
}
