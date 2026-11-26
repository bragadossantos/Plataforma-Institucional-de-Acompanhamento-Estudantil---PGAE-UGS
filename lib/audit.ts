import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { getSql } from "@/lib/db";

export type AuditEntry = {
  actorId: number | null;
  /** Perfil do autor, ou "ANONIMO" quando não há sessão. */
  actorRole: string;
  /** Ex.: LOGIN_OK, LOGIN_FALHADO, CONTA_BLOQUEADA, ACESSO_NEGADO, PASSWORD_ALTERADA */
  acao: string;
  entidade: string;
  entidadeId?: string | number | null;
  metadados?: Record<string, unknown>;
};

/** SHA-256(IP + IP_SALT). O IP em claro nunca é guardado. */
export async function ipHash(): Promise<string | null> {
  const salt = process.env.IP_SALT;
  if (!salt) return null;
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip");
  if (!ip) return null;
  return createHash("sha256").update(ip + salt).digest("hex");
}

/**
 * Regista uma ação na trilha de auditoria (só inserção).
 * Uma falha de auditoria não interrompe o pedido, mas fica sinalizada nos logs do servidor.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const sql = getSql();
    const hash = await ipHash();
    await sql`
      INSERT INTO audit_logs (actor_id, actor_role, acao, entidade, entidade_id, ip_hash, metadados)
      VALUES (${entry.actorId}, ${entry.actorRole}, ${entry.acao}, ${entry.entidade},
              ${entry.entidadeId == null ? null : String(entry.entidadeId)}, ${hash},
              ${sql.json((entry.metadados ?? {}) as never)})`;
  } catch (err) {
    console.error("[audit] falha ao registar:", entry.acao, err instanceof Error ? err.message : "erro");
  }
}
