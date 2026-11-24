import type { Filtros } from "./bi-core.ts";

const num = (v: string | null | undefined) => (v && /^\d+$/.test(v) ? Number(v) : null);

/** Lê ciclo, faculdade, curso e turma de uma query string. Devolve null se faltar um ciclo válido. */
export function filtrosDeQuery(q: URLSearchParams): Filtros | null {
  const cicloId = num(q.get("ciclo"));
  if (cicloId === null) return null;
  return { cicloId, faculdadeId: num(q.get("faculdade")), cursoId: num(q.get("curso")), turmaId: num(q.get("turma")) };
}

export function nomeFicheiro(base: string, ext: "csv" | "pdf"): string {
  const hoje = new Date().toISOString().slice(0, 10);
  return `${base}-${hoje}.${ext}`;
}
