// Bateria de segurança T1–T8 (secção 8 da especificação) e fluxo de voto a 360 px, no browser.
// Chamada por e2e/run.mjs com o contexto já montado.

export async function bateria({ base, browser, gae, dp, sql, turmaA, tdB, codigo, check }) {
  console.log("\nBateria de segurança (T1–T8)");

  // ---------------------------------------------------------------- T7 — limites estruturais pela interface
  await gae.goto(`${base}/gae/utilizadores`);
  await gae.fill("#nome", "Segundo Delegado");
  await gae.fill("#identificador", "del2.e2e@ugs.local");
  await gae.selectOption("#role", "DELEGADO");
  await gae.selectOption("#turmaId", { label: "EI3A · 2026-S2" });
  await gae.click("button:has-text('Criar utilizador')");
  await gae.waitForSelector("form [role=alert]:has-text('já tem um Delegado ativo')");
  const [{ n: delegados }] = await sql`SELECT COUNT(*)::int AS n FROM utilizadores WHERE role = 'DELEGADO' AND ativo AND turma_id = ${turmaA}`;
  check("T7: a interface recusa um 2.º Delegado ativo na mesma turma", delegados === 1, `ativos=${delegados}`);

  await gae.fill("#nome", "Subdelegado Um");
  await gae.fill("#identificador", "sub.e2e@ugs.local");
  await gae.selectOption("#role", "SUBDELEGADO");
  await gae.click("button:has-text('Criar utilizador')");
  await gae.waitForSelector("form [role=status]:has-text('Palavra-passe provisória')");
  check("T7: Subdelegado e Secretário continuam permitidos (máx. 3 cargos)", true);

  await gae.goto(`${base}/gae/estrutura?aba=turmas`);
  await gae.selectOption("#cursoId", { index: 1 });
  await gae.selectOption("#ano", "3");
  await gae.selectOption("#designacao", "A");
  await gae.selectOption("#periodo", "MANHA");
  await gae.click("button:has-text('Criar turma')");
  await gae.waitForSelector("form [role=alert]:has-text('Limite de 4 turmas')");
  const [{ nt }] = await sql`SELECT COUNT(*)::int AS nt FROM turmas WHERE ano_curricular = 3`;
  check("T7: a interface recusa a 5.ª turma no mesmo curso, ano e semestre", nt === 4, `turmas=${nt}`);

  // ---------------------------------------------------------------- T2 — acesso cruzado de turma
  const [{ antes }] = await sql`SELECT COUNT(*)::int AS antes FROM auditorias_sala`;
  await dp.goto(`${base}/delegado/auditoria`);
  await dp.selectOption("#categoria", "DIDATICA");
  await dp.click("label:has(input[value=ALTA])");
  await dp.fill("#titulo", "Tentativa de acesso cruzado");
  await dp.fill("#descricao", "Esta ocorrência tenta usar um docente de outra turma, adulterando o formulário.");
  await dp.evaluate((td) => {
    const sel = document.querySelector("#turmaDocenteId");
    const o = document.createElement("option");
    o.value = String(td);
    o.textContent = "forjado";
    sel.appendChild(o);
    sel.value = String(td);
  }, tdB);
  await dp.click("button:has-text('Enviar ao GAE')");
  let negados = 0;
  for (let i = 0; i < 40 && negados === 0; i++) {
    await new Promise((r) => setTimeout(r, 250));
    [{ negados }] = await sql`SELECT COUNT(*)::int AS negados FROM audit_logs WHERE acao = 'ACESSO_NEGADO' AND entidade = 'turma_docente'`;
  }
  const [{ depois }] = await sql`SELECT COUNT(*)::int AS depois FROM auditorias_sala`;
  check("T2: docente de outra turma adulterado no formulário é recusado (403) e nada é gravado", negados === 1 && depois === antes, `negados=${negados} gravadas=${depois - antes}`);

  await dp.goto(`${base}/delegado/auditoria`);
  await dp.selectOption("#categoria", "OUTRO");
  await dp.click("label:has(input[value=BAIXA])");
  await dp.fill("#titulo", "Ocorrência com turma_id forjado");
  await dp.fill("#descricao", "Esta ocorrência é legítima, mas o formulário foi adulterado com um turma_id falso.");
  await dp.evaluate(() => {
    const i = document.createElement("input");
    i.type = "hidden";
    i.name = "turma_id";
    i.value = "999";
    document.querySelector("form").appendChild(i);
  });
  await dp.click("button:has-text('Enviar ao GAE')");
  await dp.waitForSelector("text=Ocorrência registada e enviada ao GAE");
  const [forjada] = await sql`SELECT turma_id FROM auditorias_sala WHERE titulo = 'Ocorrência com turma_id forjado'`;
  check("T2: o servidor ignora o turma_id do formulário e usa sempre a turma da sessão", forjada?.turma_id === turmaA, `turma_id=${forjada?.turma_id}`);

  // ---------------------------------------------------------------- Mobile a 360×740 (Android pequeno)
  console.log("\nEstudante em Android pequeno (360×740)");
  // O bloqueio por códigos errados testado antes ainda vale para este IP: repõe os contadores.
  await sql`DELETE FROM rate_limits`;
  const android = await (await browser.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true })).newPage();
  android.setDefaultTimeout(45000);
  const t0 = Date.now();
  await android.goto(`${base}/votar`);
  await android.fill("#codigo", codigo);
  await android.fill("#numero", "UGS20240360");
  await android.click("button:has-text('Continuar')");
  await android.waitForURL("**/votar/*");
  const nomes = await android.$$eval("input[type=radio]", (els) => [...new Set(els.map((e) => e.name))]);
  for (const nome of nomes) await android.click(`label:has(input[name="${nome}"][value="5"])`);
  const semScroll = await android.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  const alvo = await android.$$eval("label:has(input[type=radio]) span", (els) =>
    Math.min(...els.map((e) => Math.min(e.getBoundingClientRect().width, e.getBoundingClientRect().height))),
  );
  await android.click("button:has-text('Continuar')");
  await android.waitForSelector("text=Quase a acabar");
  await android.click("button:has-text('Submeter Avaliação Anónima')");
  await android.waitForURL("**/votar/concluido");
  const seg = (Date.now() - t0) / 1000;
  check("360 px: sem scroll horizontal e alvos táteis ≥ 44 px", semScroll && alvo >= 44, `${Math.round(alvo)} px`);
  check("360 px: voto completo em menos de 90 s", seg < 90, `${seg.toFixed(1)} s`);

  // ---------------------------------------------------------------- T8 — revogação imediata
  await dp.goto(`${base}/delegado`);
  check("T8 (antes): o delegado tem a sessão aberta noutro browser", dp.url().endsWith("/delegado"));
  await gae.goto(`${base}/gae/utilizadores`);
  await gae.click("tr:has-text('delegado.e2e@ugs.local') button:has-text('Desativar')");
  await gae.waitForSelector("text=Conta desativada; sessões revogadas.");
  await dp.goto(`${base}/delegado/auditoria`);
  check("T8: a próxima ação do delegado desativado é bloqueada e redirecionada para /login", dp.url().endsWith("/login"), dp.url());
  await dp.goto(`${base}/delegado`);
  check("T8: continua bloqueado em todas as rotas protegidas", dp.url().endsWith("/login"));
}
