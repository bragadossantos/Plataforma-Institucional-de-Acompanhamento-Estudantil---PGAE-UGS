// Dados de DEMONSTRAÇÃO para testar a plataforma à mão. Só corre contra a base LOCAL (db:local).
// Uso: npm run db:demo
// Todas as contas usam a palavra-passe "Demo12345" e entram sem troca obrigatória. Nunca usar em produção.
import postgres from "postgres";
import { isLocalDatabase, sslFor } from "../lib/db-ssl.ts";
import { hashPassword } from "../lib/password.ts";
import { associarDocente, criarCurso, criarDocente, criarFaculdade, criarTurma } from "../lib/estrutura-core.ts";
import { docentesDaTurma, submeterVoto } from "../lib/vote-core.ts";
import { registarAuditoria } from "../lib/auditoria-core.ts";
import { alterarEstado, definirFentFest, definirInquietacaoVisivel } from "../lib/triagem-core.ts";

const url = process.env.DATABASE_URL;
const pepper = process.env.VOTE_PEPPER;
if (!url || !pepper) throw new Error("DATABASE_URL e VOTE_PEPPER têm de estar definidos (.env.local).");
if (!isLocalDatabase(url)) {
  console.error("Recusado: os dados de demonstração só podem ser criados numa base local.");
  process.exit(1);
}

const sql = postgres(url, { ssl: sslFor(url), max: 1 });
const SENHA = "Demo12345";

try {
  const [ja] = await sql`SELECT 1 FROM utilizadores WHERE identificador = 'admin.demo@ugs.local'`;
  if (ja) {
    console.log("Os dados de demonstração já existem. Para recomeçar: pare o db:local, apague a pasta .pglite e volte a arrancar.");
    process.exit(0);
  }

  const hash = await hashPassword(SENHA);
  const novoUtilizador = async (nome: string, identificador: string, role: string, turmaId: number | null = null) => {
    const [u] = await sql`
      INSERT INTO utilizadores (nome_completo, identificador, password_hash, role, turma_id, must_change_password)
      VALUES (${nome}, ${identificador}, ${hash}, ${role}, ${turmaId}, FALSE) RETURNING id`;
    return u.id as number;
  };

  // ---- Estrutura
  const [fac0] = await sql`SELECT id FROM faculdades WHERE sigla = 'FENT'`;
  const facId = fac0 ? (fac0.id as number) : ((await criarFaculdade(sql, { nome: "Faculdade de Engenharia e Novas Tecnologias", sigla: "FENT" })) as { id: number }).id;
  const curso = async (nome: string, codigo: string) => {
    const [c] = await sql`SELECT id FROM cursos WHERE codigo = ${codigo}`;
    return c ? (c.id as number) : ((await criarCurso(sql, { faculdadeId: facId, nome, codigo })) as { id: number }).id;
  };
  const ei = await curso("Engenharia Informática", "EI");
  const et = await curso("Engenharia de Telecomunicações", "ET");

  const turma = async (cursoId: number, ano: number, d: "A" | "B", total: number) => {
    const r = await criarTurma(sql, { cursoId, ano, designacao: d, periodo: "MANHA", semestre: "2026-S2", totalEstimado: total });
    if (!r.ok) throw new Error(r.erro);
    return { id: r.id, codigo: r.extra! };
  };
  const ei3a = await turma(ei, 3, "A", 30);
  const ei3b = await turma(ei, 3, "B", 24);
  const ei1a = await turma(ei, 1, "A", 40);
  const et2a = await turma(et, 2, "A", 28);

  const docente = async (nome: string, grau: string) => ((await criarDocente(sql, { nome, codigo: null, grau })) as { id: number }).id;
  const d = {
    ana: await docente("Ana Ferreira", "Doutora"),
    bruno: await docente("Bruno Tavares", "Mestre"),
    carla: await docente("Carla Mendes", "Mestre"),
    daniel: await docente("Daniel Costa", "Licenciado"),
    elisa: await docente("Elisa Pinto", "Doutora"),
  };
  const assoc = async (turmaId: number, docenteId: number, disciplina: string) => {
    await associarDocente(sql, { turmaId, docenteId, disciplina });
  };
  await assoc(ei3a.id, d.ana, "Algoritmos e Estruturas de Dados");
  await assoc(ei3a.id, d.bruno, "Redes de Computadores");
  await assoc(ei3a.id, d.carla, "Bases de Dados");
  await assoc(ei3b.id, d.ana, "Algoritmos e Estruturas de Dados");
  await assoc(ei3b.id, d.daniel, "Sistemas Operativos");
  await assoc(ei1a.id, d.elisa, "Introdução à Programação");
  await assoc(et2a.id, d.bruno, "Teoria da Informação");

  // ---- Contas
  const adminId = await novoUtilizador("Marta Admin (GAE)", "admin.demo@ugs.local", "GAE_ADMIN");
  await novoUtilizador("Paulo Analista (GAE)", "analista.demo@ugs.local", "GAE_ANALISTA");
  const delId = await novoUtilizador("Rui Delegado EI3A", "delegado.demo@ugs.local", "DELEGADO", ei3a.id);
  await novoUtilizador("Sara Subdelegada EI3A", "subdelegado.demo@ugs.local", "SUBDELEGADO", ei3a.id);
  await novoUtilizador("Tiago Secretário EI3A", "secretario.demo@ugs.local", "SECRETARIO", ei3a.id);
  await novoUtilizador("Delegada EI3B (demo)", "delegado.ei3b.demo@ugs.local", "DELEGADO", ei3b.id);
  await novoUtilizador("Observador (demo)", "observador.demo@ugs.local", "FENT_OBSERVER");

  // ---- Ciclo ativo
  const [ci] = await sql`
    INSERT INTO ciclos_avaliacao (titulo, semestre_letivo, data_inicio, data_fim, estado, criado_por)
    VALUES ('Avaliação Intermédia 2.º Semestre 2026', '2026-S2', NOW() - interval '2 days', NOW() + interval '12 days', 'ATIVO', ${adminId})
    RETURNING id`;
  const cicloId = ci.id as number;

  // ---- Votos: EI3A (12, notas altas) · EI3B (7, médias) · EI1A (3, abaixo de k) · ET2A (0)
  const votar = async (t: { id: number }, n: number, base: number, comentarios: string[]) => {
    const docs = await docentesDaTurma(sql, t.id);
    for (let i = 0; i < n; i++) {
      const variacao = [0, 1, -1, 0, 1, 0, -1, 1][i % 8];
      const nota = Math.max(1, Math.min(5, base + variacao));
      const r = await submeterVoto(
        sql,
        {
          turmaId: t.id,
          cicloId,
          idEstudante: `DEMO${t.id}${String(i).padStart(3, "0")}`,
          notas: docs.map((dc, j) => ({
            turmaDocenteId: dc.id,
            didatica: Math.max(1, Math.min(5, nota + (j === 1 ? -1 : 0))),
            avaliacao: nota,
            pontualidade: Math.max(1, Math.min(5, nota + (j === 2 ? 1 : 0))),
            comunicacao: nota,
            comentario: i < comentarios.length ? comentarios[i] : null,
          })),
          inquietacao:
            i === 0 ? { categoria: "LABORATORIOS", descricao: "Os laboratórios fecham cedo e não há horário afixado." }
            : i === 1 ? { categoria: "TECNOLOGIA", descricao: "O Wi-Fi das salas do 3.º piso falha durante as aulas." }
            : i === 2 ? { categoria: "SECRETARIA", descricao: "As declarações demoram mais de uma semana a ser emitidas." }
            : null,
        },
        pepper,
      );
      if (!r.ok) throw new Error(r.erro);
    }
  };
  await votar(ei3a, 12, 5, ["Explica muito bem e traz exemplos práticos.", "Aulas dinâmicas e organizadas."]);
  await votar(ei3b, 7, 3, ["Gostava de mais exercícios resolvidos.", "Às vezes chega atrasado."]);
  await votar(ei1a, 3, 4, ["Boa turma."]);

  // ---- Ocorrências do Delegado, triagem e Banco de Desafios
  const tds = await docentesDaTurma(sql, ei3a.id);
  const redes = tds.find((x) => x.disciplina.startsWith("Redes"))!;
  const o1 = (await registarAuditoria(sql, {
    turmaId: ei3a.id, autorId: delId, turmaDocenteId: null, categoria: "INFRAESTRUTURA", gravidade: "CRITICA",
    titulo: "Sala 12 sem projetor há duas semanas",
    descricao: "O projetor da sala 12 não liga desde 3 de novembro. Três aulas teóricas foram dadas sem apoio visual e o pedido de reparação à secretaria ainda não teve resposta.",
  })) as { id: number };
  const o2 = (await registarAuditoria(sql, {
    turmaId: ei3a.id, autorId: delId, turmaDocenteId: redes.id, categoria: "ASSIDUIDADE", gravidade: "ALTA",
    titulo: "Aulas de Redes iniciadas com atraso",
    descricao: "Nas últimas quatro semanas, as aulas de Redes de Computadores começaram com mais de 20 minutos de atraso em três ocasiões.",
  })) as { id: number };
  await registarAuditoria(sql, {
    turmaId: ei3a.id, autorId: delId, turmaDocenteId: null, categoria: "OUTRO", gravidade: "BAIXA",
    titulo: "Quadro da sala 9 com marcadores secos",
    descricao: "Os marcadores do quadro da sala 9 estão quase sem tinta e a turma pediu reposição na semana passada.",
  });
  await alterarEstado(sql, o2.id, "EM_ANALISE", "A conversar com a coordenação do curso.");
  await definirFentFest(sql, o1.id, true, "Equipamento de projeção avariado durante semanas sem reparação nem resposta ao pedido");
  const [inq] = await sql`SELECT id FROM inquietacoes_estudantis WHERE categoria = 'TECNOLOGIA' LIMIT 1`;
  await definirInquietacaoVisivel(sql, inq.id, true);

  console.log(`Dados de demonstração criados.
  Turmas e códigos: EI3A ${ei3a.codigo} · EI3B ${ei3b.codigo} · EI1A ${ei1a.codigo} · ET2A ${et2a.codigo}
  Todas as contas: palavra-passe ${SENHA}`);
} finally {
  await sql.end();
}
