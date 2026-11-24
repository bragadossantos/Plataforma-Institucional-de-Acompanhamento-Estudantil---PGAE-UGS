import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Testemunho de curta duração entre o ecrã 1 (código + n.º) e os ecrãs 2–3 (avaliação).
 * Vive só num cookie HttpOnly do próprio estudante: o servidor não o guarda em lado nenhum.
 * Usa uma chave derivada diferente da das sessões, para que nunca sirva como sessão.
 */
export type VoteTokenPayload = {
  /** turma validada pelo código */
  t: number;
  /** ciclo ativo */
  c: number;
  /** identificador do estudante, já normalizado */
  id: string;
  /** expiração (ms desde a época) */
  exp: number;
};

function chave(secret: string): string {
  return `${secret}:voto`;
}

function mac(body: string, secret: string): Buffer {
  return createHmac("sha256", chave(secret)).update(body).digest();
}

export function signVoteToken(p: VoteTokenPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(p), "utf8").toString("base64url");
  return `${body}.${mac(body, secret).toString("base64url")}`;
}

export function verifyVoteToken(token: string, secret: string, now = Date.now()): VoteTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const dado = Buffer.from(sig, "base64url");
  const esperado = mac(body, secret);
  if (dado.length !== esperado.length || !timingSafeEqual(dado, esperado)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<VoteTokenPayload>;
    if (!Number.isInteger(p.t) || !Number.isInteger(p.c) || typeof p.id !== "string" || typeof p.exp !== "number") return null;
    if (p.exp <= now) return null;
    return p as VoteTokenPayload;
  } catch {
    return null;
  }
}
