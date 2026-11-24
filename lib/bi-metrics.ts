/**
 * Taxa de Participação da Turma (secção 6.3):
 * TPT = votos únicos na turma / total estimado de alunos × 100 %.
 * Limitada a 100 % (a estimativa de alunos pode estar abaixo da realidade).
 */
export function taxaParticipacao(votosUnicos: number, totalEstimado: number): number {
  if (!Number.isFinite(votosUnicos) || !Number.isFinite(totalEstimado) || totalEstimado <= 0 || votosUnicos <= 0) return 0;
  return Math.min(100, (votosUnicos / totalEstimado) * 100);
}
