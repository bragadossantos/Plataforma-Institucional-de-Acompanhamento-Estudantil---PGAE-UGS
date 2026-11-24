// Banco de Desafios para o Observador, sem dependências do Next.js.
// Barreira rígida (secção 4.5): estas consultas só tocam em registos aprovados pelo GAE
// e só devolvem texto e categoria. Nunca docentes, utilizadores, turmas, datas exatas ou votos.
import type { Sql } from "postgres";

export const TEMAS = ["ACADEMICO", "LABORATORIOS", "SECRETARIA", "HORARIOS", "INFRAESTRUTURA", "TECNOLOGIA", "OUTRO"] as const;
export type Tema = (typeof TEMAS)[number];

export const TEMA_LABEL: Record<Tema, string> = {
  ACADEMICO: "Académico",
  LABORATORIOS: "Laboratórios",
  SECRETARIA: "Secretaria",
  HORARIOS: "Horários",
  INFRAESTRUTURA: "Infraestrutura",
  TECNOLOGIA: "Tecnologia",
  OUTRO: "Outro",
};

/** Categorias de ocorrência de sala → tema do Banco de Desafios. */
export function temaDaOcorrencia(categoria: string): Tema {
  if (categoria === "INFRAESTRUTURA") return "INFRAESTRUTURA";
  if (categoria === "OUTRO") return "OUTRO";
  return "ACADEMICO"; // DIDATICA, AVALIACAO, ASSIDUIDADE, CONDUTA
}

export type ItemDesafio = { origem: "ESTUDANTES" | "GAE"; texto: string };
export type GrupoDesafio = { tema: Tema; label: string; total: number; estudantes: number; gae: number; itens: ItemDesafio[] };

export async function bancoDeDesafios(sql: Sql): Promise<GrupoDesafio[]> {
  const inquietacoes = await sql`
    SELECT categoria, descricao AS texto FROM inquietacoes_estudantis WHERE visivel_fentfest ORDER BY id DESC`;
  const ocorrencias = await sql`
    SELECT categoria, resumo_anonimizado_fentfest AS texto
    FROM auditorias_sala
    WHERE elegivel_fentfest AND resumo_anonimizado_fentfest IS NOT NULL AND resumo_anonimizado_fentfest <> ''
    ORDER BY id DESC`;

  const grupos = new Map<Tema, ItemDesafio[]>();
  const add = (tema: Tema, item: ItemDesafio) => grupos.set(tema, [...(grupos.get(tema) ?? []), item]);
  for (const r of inquietacoes) {
    const tema = (TEMAS as readonly string[]).includes(r.categoria) ? (r.categoria as Tema) : "OUTRO";
    add(tema, { origem: "ESTUDANTES", texto: r.texto });
  }
  for (const r of ocorrencias) add(temaDaOcorrencia(r.categoria), { origem: "GAE", texto: r.texto });

  return [...grupos.entries()]
    .map(([tema, itens]) => ({
      tema,
      label: TEMA_LABEL[tema],
      total: itens.length,
      estudantes: itens.filter((i) => i.origem === "ESTUDANTES").length,
      gae: itens.filter((i) => i.origem === "GAE").length,
      itens,
    }))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "pt"));
}
