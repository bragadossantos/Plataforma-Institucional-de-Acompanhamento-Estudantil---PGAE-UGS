import { logAudit } from "@/lib/audit";
import { getSession, type SessionUser } from "@/lib/auth";
import { isAllowed, type Role } from "@/lib/rbac";

export type AuthApi = { ok: true; user: SessionUser } | { ok: false; response: Response };

const json = (status: number, erro: string) =>
  Response.json({ erro }, { status, headers: { "Cache-Control": "no-store" } });

/** Guarda de Route Handlers: 401 sem sessão, 403 com perfil errado (registado em audit_logs). */
export async function authApi(allowed: readonly Role[]): Promise<AuthApi> {
  const s = await getSession();
  if (!s) return { ok: false, response: json(401, "Não autenticado.") };
  if (s.mustChangePassword) return { ok: false, response: json(403, "Altere a palavra-passe provisória primeiro.") };
  if (!isAllowed(s.role, allowed)) {
    await logAudit({ actorId: s.id, actorRole: s.role, acao: "ACESSO_NEGADO", entidade: "api", metadados: { perfisPermitidos: allowed } });
    return { ok: false, response: json(403, "Sem permissão.") };
  }
  return { ok: true, user: s };
}
