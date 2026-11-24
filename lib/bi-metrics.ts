/** Regras de BI da secção 6 da especificação. Funções puras: o SQL em lib/bi-core.ts aplica as mesmas regras. */

/** Barreira de k-anonimato: abaixo disto não se mostram médias nem comentários (secção 4.3). */
export const K_MIN = 5;

export const AVISO_AMOSTRA = "Amostra insuficiente para preservação do anonimato (< 5 votos)";

/** Pesos do IDD: didática 35 %, avaliações 30 %, pontualidade 20 %, comunicação 15 %. */
export const PESOS = { didatica: 0.35, avaliacao: 0.3, pontualidade: 0.2, comunicacao: 0.15 } as const;

export type VotoNotas = { didatica: number; avaliacao: number; pontualidade: number; comunicacao: number };
export type ClasseIDD = "DESTAQUE" | "ESTAVEL" | "ALERTA";

export const CLASSE_LABEL: Record<ClasseIDD, string> = {
  DESTAQUE: "Docente Destaque",
  ESTAVEL: "Desempenho Estável",
  ALERTA: "Alerta Pedagógico",
};

export function amostraSuficiente(n: number): boolean {
  return Number.isInteger(n) && n >= K_MIN;
}

/** Contribuição de um voto: 0,35·D + 0,30·A + 0,20·P + 0,15·C. */
export function notaPonderada(v: VotoNotas): number {
  return PESOS.didatica * v.didatica + PESOS.avaliacao * v.avaliacao + PESOS.pontualidade * v.pontualidade + PESOS.comunicacao * v.comunicacao;
}

/** IDD de um docente numa turma; null se não houver votos suficientes (k ≥ 5). */
export function calcularIDD(votos: VotoNotas[]): number | null {
  if (!amostraSuficiente(votos.length)) return null;
  return votos.reduce((s, v) => s + notaPonderada(v), 0) / votos.length;
}

/** ≥ 4,20 Destaque · 3,00 a < 4,20 Estável · < 3,00 Alerta. */
export function classificarIDD(idd: number): ClasseIDD {
  // Arredonda a 4 casas para o erro de vírgula flutuante não mudar a classe (ex.: 4,1999999999 → 4,20).
  const v = Math.round(idd * 1e4) / 1e4;
  if (v >= 4.2) return "DESTAQUE";
  if (v >= 3.0) return "ESTAVEL";
  return "ALERTA";
}

/** Taxa de Participação da Turma: votos únicos / alunos estimados × 100 %, limitada a 100 %. */
export function taxaParticipacao(votosUnicos: number, totalEstimado: number): number {
  if (!Number.isFinite(votosUnicos) || !Number.isFinite(totalEstimado) || totalEstimado <= 0 || votosUnicos <= 0) return 0;
  return Math.min(100, (votosUnicos / totalEstimado) * 100);
}
