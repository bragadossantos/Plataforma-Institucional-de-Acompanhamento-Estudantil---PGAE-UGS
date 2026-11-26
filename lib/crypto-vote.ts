import { createHmac } from "node:crypto";

/**
 * Normaliza o identificador do estudante: NFKC, maiúsculas e sem espaços, hífenes, pontos ou barras.
 * "ugs 2024-001", " UGS2024001 " e "ugs.2024.001" dão o mesmo resultado (T3: voto duplicado).
 */
export function normalizarIdEstudante(id: string): string {
  return id.normalize("NFKC").toUpperCase().replace(/[\s\-_./\\]+/g, "");
}

/** 3 a 20 caracteres alfanuméricos depois de normalizado. */
export function idEstudanteValido(idNormalizado: string): boolean {
  return /^[A-Z0-9]{3,20}$/.test(idNormalizado);
}

/**
 * nullifier = HMAC-SHA256( normalizar(id) | turma_docente_id | ciclo_id , VOTE_PEPPER )
 * Calculado em memória; o identificador nunca é guardado. O pepper nunca vai para a base de dados.
 */
export function calcularNullifier(
  pepper: string,
  idNormalizado: string,
  turmaDocenteId: number,
  cicloId: number,
): string {
  if (pepper.length < 32) throw new Error("VOTE_PEPPER em falta ou demasiado curto (mínimo 32 caracteres).");
  return createHmac("sha256", pepper).update(`${idNormalizado}|${turmaDocenteId}|${cicloId}`).digest("hex");
}
