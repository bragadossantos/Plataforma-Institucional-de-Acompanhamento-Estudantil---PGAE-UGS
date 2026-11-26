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
import { bateria } from "./seguranca.mjs";
import { criarUtilizador } from "../lib/utilizadores-core.ts";
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
let tdB = 0;
for (const d of ["B", "C", "D"]) {
  const x = await criarTurma(sql, { cursoId: c.id, ano: 3, designacao: d, periodo: "MANHA", semestre: "2026-S2", totalEstimado: 40 });
  if (d === "B") {
    const doc = await criarDocente(sql, { nome: "Docente Outra Turma", codigo: null, grau: null });
    tdB = (await associarDocente(sql, { turmaId: x.id, docenteId: doc.id, disciplina: "Disciplina da turma B" })).id;
  }
}
for (const [n, disc] of [["Docente Um", "Algoritmos"], ["Docente Dois", "Redes"]]) {
  const d = await criarDocente(sql, { nome: n, codigo: null, grau: null });
  await associarDocente(sql, { turmaId: t.id, docenteId: d.id, disciplina: disc });
}
await sql`INSERT INTO utilizadores (nome_completo, identificador, password_hash, role)
          VALUES ('Admin E2E', 'admin.e2e@ugs.local', ${await hashPassword("Provisoria123")}, 'GAE_ADMIN')`;

const adm = await sql`SELECT id FROM utilizadores WHERE identificador = 'admin.e2e@ugs.local'`;
const del = await criarUtilizador(sql, { nome: "Delegado E2E", identificador: "delegado.e2e@ugs.local", role: "DELEGADO", turmaId: t.id }, adm[0].id);

const obs = await criarUtilizador(sql, { nome: "Observador E2E", identificador: "observador.e2e@ugs.local", role: "FENT_OBSERVER", turmaId: null }, adm[0].id);

// 2) Servidor Next próprio
const PROD = process.env.E2E_PROD === "1" || process.argv.includes("--prod"); // npm run e2e:prod: servidor de produção (usa o build em .next-build)
const web = spawn(process.execPath, ["node_modules/next/dist/bin/next", PROD ? "start" : "dev", "-p", String(portaWeb), "-H", "127.0.0.1"], {
  env: {
    ...process.env,
    DATABASE_URL,
    SESSION_SECRET: hex(32),
    VOTE_PEPPER: hex(32),
    IP_SALT: hex(16),
    NEXT_DIST_DIR: PROD ? ".next-build" : ".next-e2e",
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

  // Qualquer violação da CSP em qualquer página, em qualquer contexto, falha o teste.
  const violacoes = [];
  const novoContexto = browser.newContext.bind(browser);
  browser.newContext = async (...args) => {
    const ctx = await novoContexto(...args);
    ctx.on("page", (p) => {
      p.on("console", (m) => {
        if (/Content Security Policy|Refused to (execute|load|apply|connect)/i.test(m.text())) violacoes.push(m.text().slice(0, 160));
      });
      p.on("pageerror", (e) => {
        if (/Content Security Policy/i.test(String(e))) violacoes.push(String(e).slice(0, 160));
      });
    });
    return ctx;
  };

  // ------------------------------------------------------------------ Cabeçalhos de segurança
  console.log("\nCabeçalhos de segurança" + (PROD ? " (produção)" : " (desenvolvimento)"));
  const h = (await fetch(base + "/login")).headers;
  const csp = h.get("content-security-policy") ?? "";
  check("CSP com nonce por pedido, frame-ancestors 'none' e object-src 'none'", /script-src[^;]*'nonce-[^']+'/.test(csp) && csp.includes("frame-ancestors 'none'") && csp.includes("object-src 'none'"));
  const n1 = /'nonce-([^']+)'/.exec(csp)?.[1];
  const n2 = /'nonce-([^']+)'/.exec((await fetch(base + "/login")).headers.get("content-security-policy") ?? "")?.[1];
  check("o nonce muda em cada pedido", Boolean(n1 && n2 && n1 !== n2));
  check("X-Frame-Options DENY e X-Content-Type-Options nosniff", h.get("x-frame-options") === "DENY" && h.get("x-content-type-options") === "nosniff");
  check("Referrer-Policy e Permissions-Policy definidos", h.get("referrer-policy") === "strict-origin-when-cross-origin" && (h.get("permissions-policy") ?? "").includes("camera=()"));
  check("sem cabeçalho X-Powered-By", h.get("x-powered-by") === null);
  if (PROD) {
    check("HSTS ativo em produção", (h.get("strict-transport-security") ?? "").includes("max-age=31536000"));
    check("sem 'unsafe-eval' em produção", !csp.includes("unsafe-eval"));
    check("upgrade-insecure-requests em produção", csp.includes("upgrade-insecure-requests"));
  }
  check("robots.txt proíbe indexação", (await (await fetch(base + "/robots.txt")).text()).includes("Disallow: /"));
  const nf = await fetch(base + "/nao-existe");
  const nft = await nf.text();
  check("404 amigável, sem stack trace", nf.status === 404 && nft.includes("Página não encontrada") && !/\bat \w+ \(/.test(nft));


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

  // ------------------------------------------------------------------ Delegado (desktop)
  console.log("\nDelegado");
  const dp = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  dp.setDefaultTimeout(45000);
  await dp.goto(`${base}/login`);
  await dp.fill("#identificador", "delegado.e2e@ugs.local");
  await dp.fill("#password", del.senha);
  await dp.click("button:has-text('Entrar')");
  await dp.waitForURL("**/alterar-palavra-passe");
  await dp.fill("#atual", del.senha);
  await dp.fill("#nova", "Delegado12345");
  await dp.fill("#confirmar", "Delegado12345");
  await dp.click("button:has-text('Guardar')");
  await dp.waitForURL("**/delegado");
  check("delegado entra com a palavra-passe provisória e aterra no painel da turma", true);

  const painel = await dp.textContent("main");
  check("painel mostra o código da turma", painel.includes(CODIGO));
  check("painel mostra a adesão (1 de 40 alunos)", painel.includes("1 de 40 alunos"), (painel.match(/d+ de d+ alunos/) ?? [""])[0]);

  const r403 = await dp.goto(`${base}/gae`);
  check("T1: delegado em /gae recebe HTTP 403 e a página de acesso negado", r403.status() === 403 && (await dp.innerText("body")).includes("Acesso negado"), `HTTP ${r403.status()}`);
  const [{ neg }] = await sql`SELECT COUNT(*)::int AS neg FROM audit_logs WHERE acao = 'ACESSO_NEGADO' AND actor_role = 'DELEGADO'`;
  check("T1: a tentativa ficou registada em audit_logs", neg >= 1, String(neg));

  const rOk = await dp.goto(`${base}/delegado/auditoria`);
  check("controlo: página permitida devolve 200 e não mostra \"Acesso negado\"", rOk.status() === 200 && !(await dp.innerText("body")).includes("Acesso negado"));
  await dp.selectOption("#categoria", "INFRAESTRUTURA");
  await dp.click("label:has(input[value=CRITICA])");
  await dp.fill("#titulo", "Projetor da sala 12 avariado");
  await dp.fill("#descricao", "O projetor da sala 12 não liga desde segunda-feira e três aulas foram afetadas.");
  await dp.click("button:has-text('Enviar ao GAE')");
  await dp.waitForSelector("text=Ocorrência registada e enviada ao GAE");
  check("delegado regista uma ocorrência crítica", true);

  const [aud] = await sql`SELECT turma_id, estado FROM auditorias_sala`;
  check("a ocorrência ficou com a turma da sessão e estado NOVO", aud.turma_id === t.id && aud.estado === "NOVO");

  await gae.goto(`${base}/gae/auditorias`);
  check("a ocorrência aparece de imediato na fila do GAE", (await gae.textContent("main")).includes("Projetor da sala 12 avariado"));

  // ------------------------------------------------------------------ Triagem (GAE)
  console.log("\nTriagem de ocorrências");
  await gae.goto(`${base}/gae/auditorias`);
  await gae.selectOption("select[name=estado]", "EM_ANALISE");
  await gae.fill("input[name=parecer]", "A tratar com a administração");
  await gae.click("button:has-text('Guardar estado')");
  await gae.waitForSelector("text=Estado atualizado");
  const [e1] = await sql`SELECT estado, parecer_gae FROM auditorias_sala`;
  check("GAE passa a ocorrência a Em análise com parecer", e1.estado === "EM_ANALISE" && e1.parecer_gae.includes("administração"));

  await gae.check("input[name=ativo]");
  await gae.fill("input[name=resumo]", "Projetor de uma sala avariado durante semanas");
  await gae.click("button:text-is('Guardar')");
  await gae.waitForSelector("text=Enviado para o Banco de Desafios");
  const [e2] = await sql`SELECT elegivel_fentfest FROM auditorias_sala`;
  check("GAE envia a ocorrência para o Banco de Desafios", e2.elegivel_fentfest === true);

  await gae.fill("input[name=resumo]", "Queixa do delegado sobre um projetor");
  await gae.click("button:text-is('Guardar')");
  await gae.waitForSelector("form [role=alert]:has-text('nome próprio')");
  check("resumo com o nome de quem registou é recusado", true);

  // ------------------------------------------------------------------ Observador
  console.log("\nObservador");
  const op = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  op.setDefaultTimeout(45000);
  await op.goto(`${base}/login`);
  await op.fill("#identificador", "observador.e2e@ugs.local");
  await op.fill("#password", obs.senha);
  await op.click("button:has-text('Entrar')");
  await op.waitForURL("**/alterar-palavra-passe");
  await op.fill("#atual", obs.senha);
  await op.fill("#nova", "Observador12345");
  await op.fill("#confirmar", "Observador12345");
  await op.click("button:has-text('Guardar')");
  await op.waitForURL("**/insights");
  check("observador aterra em /insights", true);
  const ins = await op.textContent("body");
  check("vê o problema aprovado e o aviso de anonimização", ins.includes("Projetor de uma sala avariado durante semanas") && ins.includes("Dados anonimizados e aprovados pelo GAE"));
  check("não vê título, descrição, turma nem nomes da ocorrência", !["Projetor da sala 12 avariado", "três aulas foram afetadas", "Delegado E2E", "Admin E2E", "EI3A"].some((x) => ins.includes(x)));
  check("menu do observador só tem Desafios", (await op.locator("nav[aria-label=Principal] a").allTextContents()).join() === "Desafios");
  for (const rota of ["/gae", "/gae/ciclos", "/gae/utilizadores", "/gae/auditorias", "/delegado"]) {
    const resp = await op.goto(`${base}${rota}`);
    check(`T6: observador em ${rota} recebe HTTP 403`, resp.status() === 403 && (await op.innerText("body")).includes("Acesso negado"), `HTTP ${resp.status()}`);
  }

  // ------------------------------------------------------------------ Dashboard BI (T5)
  console.log("\nDashboard de BI");
  await gae.goto(`${base}/gae`);
  const dash = await gae.textContent("main");
  check("dashboard mostra os 4 KPIs", ["Taxa de adesão global", "Média pedagógica UGS", "Docentes em destaque", "Alertas críticos abertos"].every((k) => dash.includes(k)));
  check("T5: com 1 voto o docente mostra o aviso de amostra insuficiente", dash.includes("Amostra insuficiente para preservação do anonimato (< 5 votos)"));
  check("T5: nenhuma classificação nem média de um grupo com < 5 votos", !dash.includes("Docente Destaque") && !dash.includes("Alerta Pedagógico"));
  check("o alerta crítico da ocorrência do delegado aparece no painel", dash.includes("Projetor da sala 12 avariado"));
  // ------------------------------------------------------------------ Exportações
  console.log("\nExportações");
  const [{ cid }] = await sql`SELECT id AS cid FROM ciclos_avaliacao LIMIT 1`;
  const csvR = await gae.request.get(`${base}/api/export/csv?ciclo=${cid}`);
  const csv = await csvR.text();
  check("CSV: 200, text/csv e BOM UTF-8", csvR.status() === 200 && (csvR.headers()["content-type"] ?? "").includes("text/csv") && csv.startsWith("﻿"));
  check("CSV: grupo com 1 voto sem médias (amostra insuficiente)", csv.includes("Amostra insuficiente"));
  check("CSV: sem comentários, descrições nem identificadores", !["Projetor da sala 12", "três aulas", "UGS20240001", "Delegado E2E"].some((x) => csv.includes(x)));
  const pdfR = await gae.request.get(`${base}/api/export/pdf?ciclo=${cid}`);
  const pdf = await pdfR.body();
  check("PDF: 200, application/pdf e assinatura %PDF", pdfR.status() === 200 && (pdfR.headers()["content-type"] ?? "").includes("application/pdf") && pdf.subarray(0, 5).toString() === "%PDF-", `${pdf.length} bytes`);
  const [{ ex }] = await sql`SELECT COUNT(*)::int AS ex FROM audit_logs WHERE acao IN ('EXPORTAR_CSV', 'EXPORTAR_PDF_DIRECAO')`;
  check("cada exportação ficou registada em audit_logs", ex === 2, String(ex));
  check("exportação sem ciclo devolve 400", (await gae.request.get(`${base}/api/export/csv`)).status() === 400);

  await gae.goto(`${base}/gae`);
  const [descarga] = await Promise.all([gae.waitForEvent("download"), gae.click("text=Exportar Relatório para a Direção (PDF)")]);
  check("botão do dashboard descarrega o PDF", descarga.suggestedFilename().startsWith("pgae-relatorio-direcao-") && descarga.suggestedFilename().endsWith(".pdf"));

  const obsCsv = await op.request.get(`${base}/api/export/csv?ciclo=${cid}`);
  const obsPdf = await op.request.get(`${base}/api/export/pdf?ciclo=${cid}`);
  check("T6: observador não exporta CSV nem PDF (403)", obsCsv.status() === 403 && obsPdf.status() === 403);
  const anon = await browser.newContext();
  check("sem sessão a exportação devolve 401", (await anon.request.get(`${base}/api/export/pdf?ciclo=${cid}`)).status() === 401);
  await bateria({ base, browser, gae, dp, sql, turmaA: t.id, tdB, codigo: CODIGO, check });

  check("nenhuma violação da CSP em todas as páginas visitadas", violacoes.length === 0, violacoes[0] ?? "");
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
