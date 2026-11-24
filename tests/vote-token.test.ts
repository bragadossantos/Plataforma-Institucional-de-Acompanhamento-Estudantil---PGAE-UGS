import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { signVoteToken, verifyVoteToken } from "../lib/vote-token.ts";
import { signSession, verifySession } from "../lib/session-token.ts";

const SECRET = "s".repeat(64);
const payload = { t: 5, c: 2, id: "UGS20240001", exp: Date.now() + 60_000 };

describe("testemunho de votação", () => {
  it("aceita um token válido", () => {
    assert.deepEqual(verifyVoteToken(signVoteToken(payload, SECRET), SECRET), payload);
  });

  it("rejeita adulteração de turma/ciclo (acesso cruzado) e outro segredo", () => {
    const [, sig] = signVoteToken(payload, SECRET).split(".");
    const forjado = Buffer.from(JSON.stringify({ ...payload, t: 99 })).toString("base64url");
    assert.equal(verifyVoteToken(`${forjado}.${sig}`, SECRET), null);
    assert.equal(verifyVoteToken(signVoteToken(payload, SECRET), "x".repeat(64)), null);
  });

  it("rejeita token expirado e lixo", () => {
    assert.equal(verifyVoteToken(signVoteToken({ ...payload, exp: Date.now() - 1 }, SECRET), SECRET), null);
    for (const lixo of ["", "a", "a.b.c"]) assert.equal(verifyVoteToken(lixo, SECRET), null);
  });

  it("nunca serve como cookie de sessão (chaves diferentes)", () => {
    const comoSessao = signVoteToken({ ...payload }, SECRET);
    assert.equal(verifySession(comoSessao, SECRET), null);
    const sessao = signSession({ uid: 1, sv: 1, exp: Date.now() + 60_000 }, SECRET);
    assert.equal(verifyVoteToken(sessao, SECRET), null);
  });
});
