import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// Parâmetros da especificação (secção 4.1): N=16384, r=8, p=1, 64 bytes, salt de 16 bytes.
const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;
const SALT_BYTES = 16;

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEYLEN, { N, r: R, p: P }, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
}

/** Devolve `scrypt:<salt_hex>:<hash_hex>`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await derive(password, salt);
  return `scrypt:${salt.toString("hex")}:${key.toString("hex")}`;
}

/** Comparação em tempo constante. Formato inválido devolve false. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, hashHex] = stored.split(":");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  if (expected.length !== KEYLEN) return false;
  const actual = await derive(password, Buffer.from(saltHex, "hex"));
  return timingSafeEqual(actual, expected);
}
