// Relatório executivo para a Direção: modelo de dados, CSV e PDF.
// O modelo só contém o que o dashboard já mostra, com a barreira k ≥ 5 (sem comentários, sem alunos).
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Sql } from "postgres";
import { alertasCriticosAbertos, calcularKpis, rankingDocentes, type Filtros, type Kpis, type LinhaDocente } from "./bi-core.ts";
import { AVISO_AMOSTRA, CLASSE_LABEL, K_MIN } from "./bi-metrics.ts";

export type Relatorio = {
  ciclo: { titulo: string; semestre: string; inicio: string; fim: string };
  filtros: string;
  geradoEm: string;
  kpis: Kpis;
  ranking: LinhaDocente[];
  alertasCriticos: { titulo: string; turma: string }[];
};

const dataPt = (d: Date | string) =>
  new Date(d).toLocaleDateString("pt-AO", { timeZone: "Africa/Luanda", day: "2-digit", month: "2-digit", year: "numeric" });

export async function montarRelatorio(sql: Sql, f: Filtros): Promise<Relatorio | null> {
  const [c] = await sql`SELECT titulo, semestre_letivo, data_inicio, data_fim FROM ciclos_avaliacao WHERE id = ${f.cicloId}`;
  if (!c) return null;

  const partes: string[] = [];
  if (f.faculdadeId) partes.push(`Faculdade: ${(await sql`SELECT sigla FROM faculdades WHERE id = ${f.faculdadeId}`)[0]?.sigla ?? "?"}`);
  if (f.cursoId) partes.push(`Curso: ${(await sql`SELECT codigo FROM cursos WHERE id = ${f.cursoId}`)[0]?.codigo ?? "?"}`);
  if (f.turmaId) {
    const [t] = await sql`SELECT c.codigo || t.ano_curricular || t.designacao AS nome FROM turmas t JOIN cursos c ON c.id = t.curso_id WHERE t.id = ${f.turmaId}`;
    partes.push(`Turma: ${t?.nome ?? "?"}`);
  }

  const ranking = await rankingDocentes(sql, f);
  const kpis = await calcularKpis(sql, f, ranking);
  const alertas = await alertasCriticosAbertos(sql, f);

  return {
    ciclo: { titulo: c.titulo, semestre: c.semestre_letivo, inicio: dataPt(c.data_inicio), fim: dataPt(c.data_fim) },
    filtros: partes.length ? partes.join(" · ") : "Toda a universidade",
    geradoEm: new Date().toLocaleString("pt-AO", { timeZone: "Africa/Luanda" }),
    kpis,
    ranking,
    // Só título e turma: nunca descrição, autor nem docente.
    alertasCriticos: alertas.map((a) => ({ titulo: a.titulo, turma: a.turma })),
  };
}

// ----------------------------------------------------------------------------- CSV

/** Evita injeção de fórmulas em Excel/LibreOffice: células que começam por = + - @ são prefixadas. */
export function celulaCsv(v: string | number | null): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const num = (n: number | null, d = 2) => (n === null ? "" : n.toFixed(d).replace(".", ","));

/** CSV para Excel em português: separador ";", decimais com vírgula, BOM UTF-8. */
export function paraCsv(r: Relatorio): string {
  const cab = ["Ciclo", "Semestre", "Turma", "Disciplina", "Docente", "Votos", "IDD", "Didática", "Avaliações", "Pontualidade", "Comunicação", "Classificação"];
  const linhas = r.ranking.map((l) => [
    r.ciclo.titulo,
    r.ciclo.semestre,
    l.turma,
    l.disciplina,
    l.docente,
    l.votos,
    num(l.idd),
    num(l.didatica),
    num(l.avaliacao),
    num(l.pontualidade),
    num(l.comunicacao),
    l.visivel && l.classe ? CLASSE_LABEL[l.classe] : AVISO_AMOSTRA,
  ]);
  const corpo = [cab, ...linhas].map((l) => l.map(celulaCsv).join(";")).join("\r\n");
  return `﻿${corpo}\r\n`;
}

// ----------------------------------------------------------------------------- PDF

const COR = { ink: rgb(0.063, 0.086, 0.169), muted: rgb(0.357, 0.38, 0.471), brand: rgb(0, 0.29, 0.678), accent: rgb(0.761, 0.255, 0.047), linha: rgb(0.863, 0.847, 0.8) };
const LARG = 595.28;
const ALT = 841.89;
const M = 40;

/** Helvetica (WinAnsi) não tem alguns símbolos: troca por equivalentes ASCII. */
const seguro = (s: string) => s.replace(/≥/g, ">=").replace(/≤/g, "<=").replace(/[–—]/g, "-").replace(/[^\x20-\x7E -ÿ]/g, "?");

export async function paraPdf(r: Relatorio): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Relatório para a Direção - ${r.ciclo.titulo}`);
  doc.setProducer("PGAE");
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  const negrito = await doc.embedFont(StandardFonts.HelveticaBold);

  let pagina: PDFPage = doc.addPage([LARG, ALT]);
  let y = ALT - M;

  const nova = () => {
    pagina = doc.addPage([LARG, ALT]);
    y = ALT - M;
  };
  const garantir = (h: number) => {
    if (y - h < M + 20) nova();
  };
  const texto = (t: string, x: number, tam: number, f: PDFFont = fonte, cor = COR.ink) =>
    pagina.drawText(seguro(t), { x, y, size: tam, font: f, color: cor });
  const cortar = (t: string, larg: number, tam: number, f: PDFFont) => {
    let s = seguro(t);
    while (s.length > 1 && f.widthOfTextAtSize(s, tam) > larg) s = s.slice(0, -1);
    return s === seguro(t) ? s : `${s.slice(0, -1)}.`;
  };

  // Cabeçalho
  pagina.drawRectangle({ x: 0, y: ALT - 70, width: LARG, height: 70, color: COR.ink });
  pagina.drawText("PGAE", { x: M, y: ALT - 38, size: 22, font: negrito, color: rgb(1, 1, 1) });
  pagina.drawText("Universidade Gregório Semedo - Grupo de Acompanhamento Estudantil", {
    x: M, y: ALT - 56, size: 9, font: fonte, color: rgb(0.85, 0.85, 0.9),
  });
  y = ALT - 100;
  texto("Relatório para a Direção", M, 18, negrito, COR.ink);
  y -= 20;
  texto(`${r.ciclo.titulo} · ${r.ciclo.semestre}`, M, 11, negrito, COR.brand);
  y -= 14;
  texto(`Período: ${r.ciclo.inicio} a ${r.ciclo.fim} · ${r.filtros}`, M, 9, fonte, COR.muted);
  y -= 12;
  texto(`Gerado em ${r.geradoEm}`, M, 9, fonte, COR.muted);
  y -= 26;

  // KPIs
  const k = r.kpis;
  const cartoes: [string, string][] = [
    ["Taxa de adesão", `${k.adesaoGlobal.toFixed(0)} %`],
    ["Média pedagógica", k.mediaPedagogica === null ? "-" : k.mediaPedagogica.toFixed(2).replace(".", ",")],
    ["Docentes em destaque", String(k.docentesDestaque)],
    ["Alertas críticos", String(k.alertasCriticosAbertos)],
  ];
  const largCartao = (LARG - 2 * M - 3 * 10) / 4;
  cartoes.forEach(([rot, val], i) => {
    const x = M + i * (largCartao + 10);
    pagina.drawRectangle({ x, y: y - 52, width: largCartao, height: 56, borderColor: COR.linha, borderWidth: 1, color: rgb(0.984, 0.98, 0.965) });
    pagina.drawText(seguro(rot), { x: x + 8, y: y - 12, size: 8, font: fonte, color: COR.muted });
    pagina.drawText(seguro(val), { x: x + 8, y: y - 38, size: 20, font: negrito, color: i === 3 && k.alertasCriticosAbertos > 0 ? rgb(0.725, 0.11, 0.11) : COR.ink });
  });
  y -= 68;
  texto(`${k.votosUnicos} de ${k.alunosEstimados} alunos estimados participaram.`, M, 9, fonte, COR.muted);
  y -= 26;

  const titulo = (t: string) => {
    garantir(40);
    texto(t, M, 13, negrito, COR.ink);
    y -= 8;
    pagina.drawLine({ start: { x: M, y }, end: { x: LARG - M, y }, thickness: 1, color: COR.linha });
    y -= 16;
  };

  // Tabela de docentes
  const colunas: { rot: string; x: number; larg: number; dir?: boolean }[] = [
    { rot: "Docente / disciplina", x: M, larg: 190 },
    { rot: "Turma", x: M + 195, larg: 50 },
    { rot: "Votos", x: M + 245, larg: 35, dir: true },
    { rot: "IDD", x: M + 285, larg: 35, dir: true },
    { rot: "Classificação", x: M + 330, larg: LARG - 2 * M - 330 },
  ];
  const cabecalhoTabela = () => {
    for (const c of colunas) {
      const w = negrito.widthOfTextAtSize(c.rot, 8);
      pagina.drawText(c.rot, { x: c.dir ? c.x + c.larg - w : c.x, y, size: 8, font: negrito, color: COR.muted });
    }
    y -= 6;
    pagina.drawLine({ start: { x: M, y }, end: { x: LARG - M, y }, thickness: 0.5, color: COR.linha });
    y -= 12;
  };
  const linhaTabela = (l: LinhaDocente) => {
    garantir(28);
    const classe = l.visivel && l.classe ? CLASSE_LABEL[l.classe] : `Amostra insuficiente (< ${K_MIN} votos)`;
    const valores = [
      cortar(l.docente, colunas[0].larg, 9, negrito),
      l.turma,
      String(l.votos),
      l.idd === null ? "-" : l.idd.toFixed(2).replace(".", ","),
      cortar(classe, colunas[4].larg, 9, fonte),
    ];
    colunas.forEach((c, i) => {
      const f = i === 0 ? negrito : fonte;
      const w = f.widthOfTextAtSize(seguro(valores[i]), 9);
      pagina.drawText(seguro(valores[i]), { x: c.dir ? c.x + c.larg - w : c.x, y, size: 9, font: f, color: i === 4 && l.classe === "ALERTA" ? rgb(0.725, 0.11, 0.11) : COR.ink });
    });
    y -= 11;
    pagina.drawText(cortar(l.disciplina, colunas[0].larg, 8, fonte), { x: M, y, size: 8, font: fonte, color: COR.muted });
    y -= 12;
  };

  const destaque = r.ranking.filter((l) => l.classe === "DESTAQUE");
  titulo("Docentes em destaque (IDD >= 4,20)");
  if (destaque.length === 0) {
    texto("Nenhum docente com IDD >= 4,20 e pelo menos 5 votos neste filtro.", M, 9, fonte, COR.muted);
    y -= 20;
  } else {
    cabecalhoTabela();
    destaque.forEach(linhaTabela);
    y -= 10;
  }

  const alertasPed = r.ranking.filter((l) => l.classe === "ALERTA");
  titulo("Alertas pedagógicos (IDD < 3,00)");
  if (alertasPed.length === 0) {
    texto("Sem alertas pedagógicos neste filtro.", M, 9, fonte, COR.muted);
    y -= 20;
  } else {
    cabecalhoTabela();
    alertasPed.forEach(linhaTabela);
    y -= 10;
  }

  titulo("Ocorrências críticas abertas");
  if (r.alertasCriticos.length === 0) {
    texto("Sem ocorrências críticas abertas neste filtro.", M, 9, fonte, COR.muted);
    y -= 20;
  } else {
    for (const a of r.alertasCriticos) {
      garantir(16);
      texto(`${a.turma}  ${cortar(a.titulo, LARG - 2 * M - 60, 9, fonte)}`, M, 9);
      y -= 14;
    }
    y -= 6;
  }

  titulo("Todos os docentes avaliados");
  if (r.ranking.length === 0) {
    texto("Ainda não há votos neste ciclo e filtro.", M, 9, fonte, COR.muted);
    y -= 20;
  } else {
    cabecalhoTabela();
    r.ranking.forEach(linhaTabela);
  }

  garantir(50);
  y -= 14;
  const nota =
    "Nota: por proteção do anonimato dos estudantes, médias e classificações só são apresentadas quando existem pelo menos 5 votos válidos. Os votos são anónimos e não é possível identificar quem votou.";
  const palavras = seguro(nota).split(" ");
  let linha = "";
  for (const p of palavras) {
    const teste = linha ? `${linha} ${p}` : p;
    if (fonte.widthOfTextAtSize(teste, 8) > LARG - 2 * M) {
      garantir(12);
      texto(linha, M, 8, fonte, COR.muted);
      y -= 11;
      linha = p;
    } else linha = teste;
  }
  if (linha) texto(linha, M, 8, fonte, COR.muted);

  // Rodapé com numeração
  const paginas = doc.getPages();
  paginas.forEach((p, i) => {
    p.drawText(`PGAE · UGS · Página ${i + 1} de ${paginas.length}`, { x: M, y: 22, size: 8, font: fonte, color: COR.muted });
  });

  return doc.save();
}
