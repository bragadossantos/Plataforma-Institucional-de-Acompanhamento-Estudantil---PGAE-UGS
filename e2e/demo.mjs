// Verifica as contas de demonstração contra o site em localhost:3000 (precisa de db:local, db:demo e dev a correr).
import { chromium } from "playwright-core";

const base = "http://localhost:3000";
const browser = await chromium.launch({ channel: "msedge" });
let falhas = 0;
const ok = (n, c, d = "") => {
  if (!c) falhas++;
  console.log(`${c ? "  ✔" : "  ✖"} ${n}${d ? " — " + d : ""}`);
};

async function entrar(email) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage();
  p.setDefaultTimeout(60000);
  await p.goto(`${base}/login`);
  await p.fill("#identificador", email);
  await p.fill("#password", "Demo12345");
  await p.click("button:has-text('Entrar')");
  await p.waitForURL((u) => !u.pathname.startsWith("/login"));
  return p;
}
const texto = async (p, rota) => {
  await p.goto(`${base}${rota}`);
  return p.innerText("body");
};

console.log("Admin GAE");
let p = await entrar("admin.demo@ugs.local");
ok("aterra em /gae", p.url().endsWith("/gae"));
let t = await p.textContent("main");
ok("KPIs com dados (adesão e destaque)", /Taxa de adesão global/.test(t) && /Docentes em destaque/.test(t), (t.match(/\d+ %/) ?? [""])[0]);
ok("aviso de amostra insuficiente (EI1A com 3 votos)", t.includes("Amostra insuficiente"));
for (const r of ["/gae/estrutura", "/gae/utilizadores", "/gae/ciclos", "/gae/auditorias", "/gae/relatorios", "/insights"]) {
  const x = await texto(p, r);
  ok(`${r} abre`, !x.includes("Acesso negado") && !x.includes("Algo correu mal"));
}
await p.context().close();

console.log("Analista GAE");
p = await entrar("analista.demo@ugs.local");
ok("aterra em /gae", p.url().endsWith("/gae"));
ok("/gae/estrutura é 403 (só admin)", (await texto(p, "/gae/estrutura")).includes("Acesso negado"));
ok("/gae/auditorias abre", !(await texto(p, "/gae/auditorias")).includes("Acesso negado"));
await p.context().close();

console.log("Delegado EI3A");
p = await entrar("delegado.demo@ugs.local");
ok("aterra em /delegado", p.url().endsWith("/delegado"));
t = await p.textContent("main");
ok("vê o código da turma e a adesão", /EI3A-[A-Z0-9]{4}/.test(t) && /\d+ de 30 alunos/.test(t), (t.match(/\d+ de \d+ alunos/) ?? [""])[0]);
ok("/gae é 403", (await texto(p, "/gae")).includes("Acesso negado"));
ok("/delegado/auditoria lista as 3 ocorrências", ((await texto(p, "/delegado/auditoria")).match(/Sala 12 sem projetor|Aulas de Redes|Quadro da sala 9/g) ?? []).length === 3);
await p.context().close();

console.log("Subdelegado e Secretário");
for (const e of ["subdelegado.demo@ugs.local", "secretario.demo@ugs.local"]) {
  p = await entrar(e);
  ok(`${e} aterra em /delegado`, p.url().endsWith("/delegado"));
  await p.context().close();
}

console.log("Delegado EI3B (só vê a sua turma)");
p = await entrar("delegado.ei3b.demo@ugs.local");
t = await p.textContent("main");
ok("painel da EI3B, sem ocorrências da EI3A", t.includes("EI3B") && !(await texto(p, "/delegado/auditoria")).includes("Sala 12"));
await p.context().close();

console.log("Observador");
p = await entrar("observador.demo@ugs.local");
ok("aterra em /insights", p.url().endsWith("/insights"));
t = await p.textContent("main");
ok("vê o problema aprovado e a inquietação aprovada", t.includes("Equipamento de projeção avariado") && t.includes("Wi-Fi das salas"));
ok("não vê a descrição interna nem nomes", !t.includes("Sala 12 sem projetor") && !t.includes("Rui") && !t.includes("Redes"));
ok("/gae é 403", (await texto(p, "/gae")).includes("Acesso negado"));
await p.context().close();

console.log("Estudante (sem conta)");
const aluno = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })).newPage();
aluno.setDefaultTimeout(60000);
await aluno.goto(`${base}/votar`);
ok("/votar abre com o selo de anonimato", (await aluno.textContent("body")).includes("Voto 100% anónimo"));

await browser.close();
console.log(falhas ? `\n${falhas} verificação(ões) falharam.` : "\nTudo certo.");
process.exit(falhas ? 1 : 0);
