// Teste de ponta a ponta no browser (Edge/Chrome instalado), com base de dados e servidor próprios.
// Uso: npm run e2e      (não toca na base de dados nem no servidor de desenvolvimento)
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import { chromium } from "playwright-core";
import postgres from "postgres";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { hashPassword } from "../lib/password.ts";
import { associarDocente, criarCurso, criarDocente, criarFaculdade, criarTurma } from "../lib/estrutura-core.ts";

const resultados = [];
function check(nome, ok, detalhe = "") {
  resultados.push({ nome, ok });
  console.log(`${ok ? "  ✔" : "  ✖"} ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
}

const livre = () =>
  new Promise((res, rej) => {
    const s = createServer();
    s.once("error", rej);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => res(port));
    });
  });

const hex = (n) => randomBytes(n).toString("hex");
const portaBd = await livre();
const portaWeb = await livre();
const base = `http://127.0.0.1:${portaWeb}`;

// 1) Base de dados própria
const db = await PGlite.create();
await db.exec(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));
const bd = new PGLiteSocketServer({ db, port: portaBd, host: "127.0.0.1", maxConnections: 10 });
await bd.start();
const DATABASE_URL = `postgres://postgres:postgres@127.0.0.1:${portaBd}/postgres`;
const sql = postgres(DATABASE_URL, { ssl: false, max: 1 });

const f = await criarFaculdade(sql, { nome: "FENT", sigla: "FENT" });
const c = await criarCurso(sql, { faculdadeId: f.id, nome: "Eng. Informática", codigo: "EI" });
const t = await criarTurma(sql, { cursoId: c.id, ano: 3, designacao: "A", periodo: "MANHA", semestre: "2026-S2", totalEstimado: 40 });
const CODIGO = t.extra;
for (const [n, disc] of [["Docente Um", "Algoritmos"], ["Docente Dois", "Redes"]]) {
  const d = await criarDocente(sql, { nome: n, codigo: null, grau: null });
  await associarDocente(sql, { turmaId: t.id, docenteId: d.id, disciplina: disc });
}
await sql`INSERT INTO utilizadores (nome_completo, identificador, password_hash, role)
          VALUES ('Admin E2E', 'admin.e2e@ugs.local', ${await hashPassword("Provisoria123")}, 'GAE_ADMIN')`;

// 2) Servidor Next próprio
const web = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "-p", String(portaWeb), "-H", "127.0.0.1"], {
  env: {
    ...process.env,
    DATABASE_URL,
    SESSION_SECRET: hex(32),
    VOTE_PEPPER: hex(32),
    IP_SALT: hex(16),
    NEXT_DIST_DIR: ".next-e2e",
    NEXT_TELEMETRY_DISABLED: "1",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let log = "";
web.stdout.on("data", (d) => (log += d));
web.stderr.on("data", (d) => (log += d));
for (let i = 0; i < 90 && !log.includes("Ready"); i++) await new Promise((r) => setTimeout(r, 1000));
if (!log.includes("Ready")) {
  console.error("Servidor não arrancou:\n" + log);
  process.exit(1);
}

// Aquece as rotas públicas: a primeira compilação em modo de desenvolvimento é lenta.
for (const rota of ["/login", "/votar"]) {
  try {
    await fetch(base + rota, { signal: AbortSignal.timeout(120000) });
  } catch {
    /* continua; o browser tentará de novo */
  }
}

let browser;
try {
  browser = await chromium.launch({ channel: "msedge" });

  // ------------------------------------------------------------------ GAE (desktop)
  console.log("\nGAE no desktop");
  const gae = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  gae.setDefaultTimeout(45000);

  await gae.goto(`${base}/login`);
  await gae.fill("#identificador", "admin.e2e@ugs.local");
  await gae.fill("#password", "errada123");
  await gae.click("button:has-text('Entrar')");
  await gae.waitForSelector("form [role=alert]");
  const msg = await gae.textContent("form [role=alert]");
  check("login com palavra-passe errada mostra erro genérico", msg.includes("Credenciais inválidas"), msg);

  await gae.fill("#password", "Provisoria123");
  await gae.click("button:has-text('Entrar')");
  await gae.waitForURL("**/alterar-palavra-passe");
  check("1.º acesso obriga a trocar a palavra-passe", true);

  await gae.fill("#atual", "Provisoria123");
  await gae.fill("#nova", "curta");
  await gae.fill("#confirmar", "curta");
  await gae.click("button:has-text('Guardar')");
  await gae.waitForSelector("text=Mínimo 8 caracteres");
  check("palavra-passe fraca é recusada", true);

  await gae.fill("#nova", "NovaSegura123");
  await gae.fill("#confirmar", "NovaSegura123");
  await gae.click("button:has-text('Guardar')");
  await gae.waitForURL("**/gae");
  check("troca de palavra-passe leva ao painel GAE", true);

  await gae.goto(`${base}/gae/ciclos`);
  await gae.fill("#titulo", "Avaliação E2E");
  const hoje = new Date();
  const dia = (d) => new Date(hoje.getTime() + d * 86400000).toISOString().slice(0, 10);
  await gae.fill("#inicio", dia(-1));
  await gae.fill("#fim", dia(7));
  await gae.click("button:has-text('Criar ciclo')");
  await gae.waitForSelector("text=Ciclo criado em rascunho");
  await gae.click("button:has-text('Abrir votação')");
  await gae.waitForSelector("td span:text-is('Ativo')");
  check("GAE cria e abre um ciclo de avaliação", true);

  // ------------------------------------------------------------------ Estudante (telemóvel 390x844)
  console.log("\nEstudante no telemóvel (390×844)");
  const ctxAluno = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const aluno = await ctxAluno.newPage();
  aluno.setDefaultTimeout(45000);
  const inicio = Date.now();

  await aluno.goto(`${base}/votar`);
  await aluno.fill("#codigo", "EI3A-ZZZZ");
  await aluno.fill("#numero", "UGS20240001");
  await aluno.click("button:has-text('Continuar')");
  await aluno.waitForSelector("form [role=alert]");
  check("código errado é recusado", (await aluno.textContent("form [role=alert]")).includes("Código inválido"));

  await aluno.fill("#codigo", CODIGO.toLowerCase());
  await aluno.click("button:has-text('Continuar')");
  await aluno.waitForURL("**/votar/*");
  check("código certo (em minúsculas) abre a avaliação", /\/votar\/\d+$/.test(aluno.url()));

  await aluno.click("button:has-text('Continuar')");
  await aluno.waitForSelector("[role=alert]:has-text('Falta avaliar')");
  check("não deixa avançar com notas em falta", true);

  const ids = await aluno.$$eval("input[type=radio]", (els) => [...new Set(els.map((e) => e.name))]);
  for (const nome of ids) await aluno.click(`label:has(input[name="${nome}"][value="4"])`);
  const alvoMin = await aluno.$$eval("label:has(input[type=radio]) span", (els) =>
    Math.min(...els.map((e) => Math.min(e.getBoundingClientRect().width, e.getBoundingClientRect().height))),
  );
  check("botões de nota com alvo táctil ≥ 44 px", alvoMin >= 44, `${Math.round(alvoMin)} px`);
  const semScroll = await aluno.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  check("sem scroll horizontal a 390 px", semScroll);

  await aluno.click("button:has-text('Continuar')");
  await aluno.waitForSelector("text=Quase a acabar");
  await aluno.selectOption("select[name=categoria]", "LABORATORIOS");
  await aluno.fill("#inquietacao", "Horários dos laboratórios pouco claros");
  await aluno.click("button:has-text('Submeter Avaliação Anónima')");
  await aluno.waitForURL("**/votar/concluido");
  const seg = (Date.now() - inicio) / 1000;
  check("voto submetido até ao ecrã de agradecimento", true);
  check("fluxo completo em menos de 90 s", seg < 90, `${seg.toFixed(1)} s`);

  const [{ vc }] = await sql`SELECT COUNT(*)::int AS vc FROM votos_controlo`;
  const [{ vd }] = await sql`SELECT COUNT(*)::int AS vd FROM votos_docentes`;
  const [{ iq }] = await sql`SELECT COUNT(*)::int AS iq FROM inquietacoes_estudantis`;
  check("gravou 1 controlo e 1 voto por docente e 1 inquietação", vc === 2 && vd === 2 && iq === 1, `${vc}/${vd}/${iq}`);
  const dump = JSON.stringify(await sql`SELECT * FROM votos_docentes`) + JSON.stringify(await sql`SELECT * FROM inquietacoes_estudantis`);
  check("nenhum identificador do aluno nas tabelas de conteúdo", !dump.includes("UGS20240001"));

  // T3: o mesmo aluno, com outra grafia
  await aluno.goto(`${base}/votar`);
  await aluno.fill("#codigo", CODIGO);
  await aluno.fill("#numero", " ugs-2024-0001 ");
  await aluno.click("button:has-text('Continuar')");
  await aluno.waitForSelector("form [role=alert]");
  check("T3: segunda tentativa com outra grafia é bloqueada", (await aluno.textContent("form [role=alert]")).includes("Já votaste"));

  // Sem testemunho não se acede à avaliação
  const sem = await (await browser.newContext()).newPage();
  await sem.goto(`${base}/votar/1`);
  check("avaliação sem passar pelo ecrã 1 volta ao ecrã 1", sem.url().endsWith("/votar"));

  // Honeypot
  const bot = await (await browser.newContext()).newPage();
  await bot.goto(`${base}/votar`);
  await bot.evaluate(() => {
    document.querySelector("#website").value = "http://spam";
  });
  await bot.fill("#codigo", CODIGO);
  await bot.fill("#numero", "BOT0000001");
  await bot.click("button:has-text('Continuar')");
  await bot.waitForURL("**/votar/concluido");
  const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM votos_controlo`;
  check("honeypot preenchido: parece sucesso mas nada é gravado", n === 2, `controlos=${n}`);

  // Rate limit de códigos errados: 5 falhas e fica bloqueado
  const rl = await (await browser.newContext()).newPage();
  for (let i = 0; i < 5; i++) {
    await rl.goto(`${base}/votar`);
    await rl.fill("#codigo", `XXXX-000${i}`);
    await rl.fill("#numero", "UGS20249999");
    await rl.click("button:has-text('Continuar')");
    await rl.waitForSelector("form [role=alert]");
  }
  await rl.goto(`${base}/votar`);
  await rl.fill("#codigo", CODIGO);
  await rl.fill("#numero", "UGS20248888");
  await rl.click("button:has-text('Continuar')");
  await rl.waitForSelector("form [role=alert]");
  check("5 códigos errados bloqueiam o IP, mesmo com o código certo", (await rl.textContent("form [role=alert]")).includes("Demasiadas tentativas"));
} catch (e) {
  check("execução sem exceções", false, String(e).split("\n")[0]);
  console.error(e);
  console.error("--- log do servidor (fim) ---\n" + log.split("\n").slice(-40).join("\n"));
} finally {
  await browser?.close();
  web.kill();
  await sql.end();
  await bd.stop();
  await db.close();
}

const falhas = resultados.filter((r) => !r.ok).length;
console.log(`\n${resultados.length - falhas}/${resultados.length} verificações passaram.`);
process.exit(falhas ? 1 : 0);
