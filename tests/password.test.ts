import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../lib/password.ts";

describe("palavras-passe (scrypt)", () => {
  it("gera formato scrypt:<salt>:<hash> com salt de 16 bytes e hash de 64", async () => {
    const h = await hashPassword("Segredo123");
    const [scheme, salt, hash] = h.split(":");
    assert.equal(scheme, "scrypt");
    assert.equal(salt.length, 32);
    assert.equal(hash.length, 128);
  });

  it("verifica a palavra-passe correta e rejeita a errada", async () => {
    const h = await hashPassword("Segredo123");
    assert.equal(await verifyPassword("Segredo123", h), true);
    assert.equal(await verifyPassword("segredo123", h), false);
  });

  it("dois hashes da mesma palavra-passe diferem (salt único)", async () => {
    assert.notEqual(await hashPassword("Segredo123"), await hashPassword("Segredo123"));
  });

  it("formato inválido devolve false sem lançar erro", async () => {
    assert.equal(await verifyPassword("x", "lixo"), false);
    assert.equal(await verifyPassword("x", "scrypt:ab:cd"), false);
  });
});
