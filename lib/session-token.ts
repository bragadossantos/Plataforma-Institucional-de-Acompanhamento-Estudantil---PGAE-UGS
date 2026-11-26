import { createHmac, timingSafeEqual } from "node:crypto";

export type SessionPayload = {
  /** id do utilizador */
  uid: number;
  /** session_version no momento do login (revogação instantânea) */
  sv: number;
  /** expiração, em ms desde a época */
  exp: number;
};

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function mac(body: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(body).digest();
}

/** Token `<payload>.<assinatura>` assinado com HMAC-SHA256. */
export function signSession(payload: SessionPayload, secret: string): string {
  const body = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  return `${body}.${b64url(mac(body, secret))}`;
}

/** Devolve o payload se a assinatura for válida e não tiver expirado; caso contrário null. */
export function verifySession(token: string, secret: string, now = Date.now()): SessionPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;

  const given = Buffer.from(sig, "base64url");
  const expected = mac(body, secret);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<SessionPayload>;
    if (!Number.isInteger(p.uid) || !Number.isInteger(p.sv) || typeof p.exp !== "number") return null;
    if (p.exp <= now) return null;
    return p as SessionPayload;
  } catch {
    return null;
  }
}
