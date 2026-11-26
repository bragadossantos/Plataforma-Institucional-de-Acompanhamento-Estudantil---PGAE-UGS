// Triagem de ocorrências e curadoria para o Banco de Desafios, sem dependências do Next.js.
import type { Sql } from "postgres";

export const ESTADOS = ["NOVO", "EM_ANALISE", "ENCAMINHADO_DIRECAO", "RESOLVIDO", "ARQUIVADO"] as const;
export type Estado = (typeof ESTADOS)[number];

export const ESTADO_LABEL: Record<Estado, string> = {
  NOVO: "Novo",
  EM_ANALISE: "Em análise",
  ENCAMINHADO_DIRECAO: "Encaminhado à Direção",
  RESOLVIDO: "Resolvido",
  ARQUIVADO: "Arquivado",
};

/** Fluxo normal: NOVO → EM_ANALISE → ENCAMINHADO_DIRECAO → RESOLVIDO; qualquer fase pode ser arquivada. ARQUIVADO é final. */
const TRANSICOES: Record<Estado, readonly Estado[]> = {
  NOVO: ["EM_ANALISE", "ARQUIVADO"],
  EM_ANALISE: ["ENCAMINHADO_DIRECAO", "RESOLVIDO", "ARQUIVADO"],
  ENCAMINHADO_DIRECAO: ["RESOLVIDO", "ARQUIVADO"],
  RESOLVIDO: ["ARQUIVADO"],
  ARQUIVADO: [],
};

export function transicoesPermitidas(e: Estado): readonly Estado[] {
  return TRANSICOES[e];
}

export type Res = { ok: true } | { ok: false; erro: string };

const normaliza = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const PARTICULAS = new Set(["de", "da", "do", "das", "dos", "e", "a", "o"]);

/**
 * O resumo para o FENT Fest não pode conter nomes de docentes, de quem registou, nem contactos.
 * `proibidos` = nomes completos a evitar. Compara palavra a palavra, sem acentos nem maiúsculas.
 */
export function resumoSeguro(resumo: string, proibidos: string[]): Res {
  const t = resumo.trim();
  if (t.length < 10) return { ok: false, erro: "O resumo deve ter pelo menos 10 caracteres." };
  if (t.length > 300) return { ok: false, erro: "O resumo pode ter no máximo 300 caracteres." };
  if (/@|https?:\/\/|www\./i.test(t) || /\d{7,}/.test(t)) {
    return { ok: false, erro: "O resumo não pode conter e-mails, ligações ou números de identificação." };
  }
  const palavras = new Set(normaliza(t).split(/[^a-z0-9]+/).filter(Boolean));
  for (const nome of proibidos) {
    for (const p of normaliza(nome).split(/[^a-z0-9]+/)) {
      if (p.length >= 3 && !PARTICULAS.has(p) && palavras.has(p)) {
        return { ok: false, erro: "O resumo contém um nome próprio de pessoa envolvida. Reescreva-o de forma impessoal." };
      }
    }
  }
  return { ok: true };
}

export async function alterarEstado(sql: Sql, id: number, novo: Estado, parecer: string | null): Promise<Res> {
  const [a] = await sql`SELECT estado FROM auditorias_sala WHERE id = ${id}`;
  if (!a) return { ok: false, erro: "Ocorrência não encontrada." };
  if (!transicoesPermitidas(a.estado as Estado).includes(novo)) {
    return { ok: false, erro: `Não é possível passar de "${ESTADO_LABEL[a.estado as Estado]}" para "${ESTADO_LABEL[novo]}".` };
  }
  await sql`
    UPDATE auditorias_sala
    SET estado = ${novo}, parecer_gae = COALESCE(${parecer}, parecer_gae), atualizado_em = NOW()
    WHERE id = ${id}`;
  return { ok: true };
}

/** Liga/desliga a ocorrência no Banco de Desafios. Ao ligar, o resumo impessoal é obrigatório e verificado. */
export async function definirFentFest(sql: Sql, id: number, ativo: boolean, resumo: string | null): Promise<Res> {
  const [a] = await sql`
    SELECT d.nome_completo AS docente, u.nome_completo AS autor
    FROM auditorias_sala a
    JOIN utilizadores u ON u.id = a.autor_id
    LEFT JOIN turma_docentes td ON td.id = a.turma_docente_id
    LEFT JOIN docentes d ON d.id = td.docente_id
    WHERE a.id = ${id}`;
  if (!a) return { ok: false, erro: "Ocorrência não encontrada." };

  if (!ativo) {
    await sql`UPDATE auditorias_sala SET elegivel_fentfest = FALSE, atualizado_em = NOW() WHERE id = ${id}`;
    return { ok: true };
  }
  const v = resumoSeguro(resumo ?? "", [a.docente, a.autor].filter(Boolean));
  if (!v.ok) return v;
  await sql`
    UPDATE auditorias_sala
    SET elegivel_fentfest = TRUE, resumo_anonimizado_fentfest = ${(resumo as string).trim()}, atualizado_em = NOW()
    WHERE id = ${id}`;
  return { ok: true };
}

export async function definirInquietacaoVisivel(sql: Sql, id: number, visivel: boolean): Promise<Res> {
  const [r] = await sql`UPDATE inquietacoes_estudantis SET visivel_fentfest = ${visivel} WHERE id = ${id} RETURNING id`;
  return r ? { ok: true } : { ok: false, erro: "Inquietação não encontrada." };
}
