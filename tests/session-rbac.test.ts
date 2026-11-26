import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { signSession, verifySession } from "../lib/session-token.ts";
import { GAE_ROLES, homeFor, isAllowed, isRole, LIDERANCA_ROLES, navFor } from "../lib/rbac.ts";
import { alterarPasswordSchema, loginSchema, novaPasswordSchema, texto } from "../lib/validators.ts";

const SECRET = "a".repeat(64);

describe("token de sessão (HMAC-SHA256)", () => {
  const payload = { uid: 7, sv: 3, exp: Date.now() + 60_000 };

  it("aceita um token válido", () => {
    assert.deepEqual(verifySession(signSession(payload, SECRET), SECRET), payload);
  });

  it("rejeita assinatura com outro segredo", () => {
    assert.equal(verifySession(signSession(payload, SECRET), "b".repeat(64)), null);
  });

  it("rejeita payload adulterado (escalada de uid)", () => {
    const [, sig] = signSession(payload, SECRET).split(".");
    const forjado = Buffer.from(JSON.stringify({ ...payload, uid: 1 })).toString("base64url");
    assert.equal(verifySession(`${forjado}.${sig}`, SECRET), null);
  });

  it("rejeita token expirado e lixo", () => {
    const t = signSession({ ...payload, exp: Date.now() - 1 }, SECRET);
    assert.equal(verifySession(t, SECRET), null);
    for (const lixo of ["", "abc", "a.b.c", "a.b"]) assert.equal(verifySession(lixo, SECRET), null);
  });
});

describe("RBAC", () => {
  it("só reconhece os 6 perfis da especificação", () => {
    assert.equal(isRole("GAE_ADMIN"), true);
    assert.equal(isRole("ADMIN"), false);
    assert.equal(isRole(undefined), false);
  });

  it("DELEGADO não acede a rotas GAE e FENT_OBSERVER não acede a GAE nem liderança (T1, T6)", () => {
    assert.equal(isAllowed("DELEGADO", GAE_ROLES), false);
    assert.equal(isAllowed("FENT_OBSERVER", GAE_ROLES), false);
    assert.equal(isAllowed("FENT_OBSERVER", LIDERANCA_ROLES), false);
    assert.equal(isAllowed("GAE_ANALISTA", GAE_ROLES), true);
    assert.equal(isAllowed("SECRETARIO", LIDERANCA_ROLES), true);
  });

  it("cada perfil aterra na sua página e o menu do observador só tem /insights", () => {
    assert.equal(homeFor("GAE_ADMIN"), "/gae");
    assert.equal(homeFor("SUBDELEGADO"), "/delegado");
    assert.equal(homeFor("FENT_OBSERVER"), "/insights");
    assert.deepEqual(navFor("FENT_OBSERVER").map((i) => i.href), ["/insights"]);
  });

  it("só o GAE_ADMIN vê Estrutura e Utilizadores no menu", () => {
    const tem = (r: Parameters<typeof navFor>[0], h: string) => navFor(r).some((i) => i.href === h);
    assert.equal(tem("GAE_ADMIN", "/gae/estrutura"), true);
    assert.equal(tem("GAE_ANALISTA", "/gae/estrutura"), false);
    assert.equal(tem("GAE_ANALISTA", "/gae/utilizadores"), false);
  });
});

describe("validadores Zod", () => {
  it("palavra-passe: mínimo 8, com letras e números", () => {
    assert.equal(novaPasswordSchema.safeParse("curta1").success, false);
    assert.equal(novaPasswordSchema.safeParse("somenteletras").success, false);
    assert.equal(novaPasswordSchema.safeParse("12345678").success, false);
    assert.equal(novaPasswordSchema.safeParse("Segura123").success, true);
  });

  it("troca de palavra-passe exige confirmação igual e diferente da atual", () => {
    assert.equal(alterarPasswordSchema.safeParse({ atual: "Antiga123", nova: "Nova12345", confirmar: "Outra12345" }).success, false);
    assert.equal(alterarPasswordSchema.safeParse({ atual: "Antiga123", nova: "Antiga123", confirmar: "Antiga123" }).success, false);
    assert.equal(alterarPasswordSchema.safeParse({ atual: "Antiga123", nova: "Nova12345", confirmar: "Nova12345" }).success, true);
  });

  it("login rejeita campos vazios ou nulos", () => {
    assert.equal(loginSchema.safeParse({ identificador: "", password: "x" }).success, false);
    assert.equal(loginSchema.safeParse({ identificador: null, password: null }).success, false);
  });

  it("texto remove tags HTML e limita o tamanho", () => {
    const t = texto(10);
    assert.equal(t.parse("  <b>olá</b> mundo "), "olá mundo");
    assert.equal(t.safeParse("<script></script>").success, false);
    assert.equal(t.safeParse("x".repeat(11)).success, false);
  });
});
