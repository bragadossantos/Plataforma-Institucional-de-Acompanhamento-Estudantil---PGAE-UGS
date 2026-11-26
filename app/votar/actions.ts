"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ipHash } from "@/lib/audit";
import { getSql } from "@/lib/db";
import { idEstudanteValido, normalizarIdEstudante } from "@/lib/crypto-vote";
import { consumir, excedido, LIMITE_CODIGO_ERRADO, LIMITE_VOTO, registar } from "@/lib/rate-limit";
import { signVoteToken, verifyVoteToken } from "@/lib/vote-token";
import {
  CATEGORIAS_INQUIETACAO,
  docentesDaTurma,
  jaVotou,
  resolverCodigo,
  submeterVoto,
  type CategoriaInquietacao,
  type NotasDocente,
} from "@/lib/vote-core";
import { entradaVotoSchema } from "@/lib/validators";

import { VOTO_COOKIE } from "@/lib/vote-cookie";
const VOTO_TTL_S = 30 * 60;

export type VotoState = { erro?: string };

function segredo(k: "SESSION_SECRET" | "VOTE_PEPPER"): string {
  const s = process.env[k];
  if (!s || s.length < 32) throw new Error(`${k} em falta ou demasiado curto (mínimo 32 caracteres).`);
  return s;
}

async function chaveIp(prefixo: string): Promise<string> {
  return `${prefixo}:${(await ipHash()) ?? "desconhecido"}`;
}

/**
 * Ecrã 1: valida código da turma + n.º de estudante e abre a votação.
 * Nada é gravado: o identificador segue num cookie HttpOnly assinado, só durante a votação.
 */
export async function iniciarVotoAction(_: VotoState, form: FormData): Promise<VotoState> {
  const sql = getSql();

  // Honeypot: descarta bots em silêncio, com a mesma resposta de uma submissão normal.
  if (String(form.get("website") ?? "") !== "") redirect("/votar/concluido");

  const limite = await consumir(sql, await chaveIp("voto"), LIMITE_VOTO);
  if (!limite.permitido) return { erro: "Demasiados pedidos a partir desta rede. Aguarde alguns minutos." };
  const chaveCodigo = await chaveIp("codigo");
  if (await excedido(sql, chaveCodigo, LIMITE_CODIGO_ERRADO)) {
    return { erro: "Demasiadas tentativas com códigos errados. Aguarde 15 minutos." };
  }

  const p = entradaVotoSchema.safeParse({ codigo: form.get("codigo"), numero: form.get("numero"), website: "" });
  if (!p.success) return { erro: p.error.issues[0]?.message ?? "Dados inválidos." };

  const id = normalizarIdEstudante(p.data.numero);
  if (!idEstudanteValido(id)) return { erro: "Número de estudante inválido (3 a 20 letras e números)." };

  const ctx = await resolverCodigo(sql, p.data.codigo);
  if (!ctx) {
    await registar(sql, chaveCodigo, LIMITE_CODIGO_ERRADO.janelaSeg);
    return { erro: "Código inválido, ou a votação desta turma não está aberta." };
  }

  if (await jaVotou(sql, { turmaId: ctx.turmaId, cicloId: ctx.cicloId, idEstudante: id }, segredo("VOTE_PEPPER"))) {
    return { erro: "Já votaste neste ciclo. Cada estudante só pode votar uma vez." };
  }

  const token = signVoteToken(
    { t: ctx.turmaId, c: ctx.cicloId, id, exp: Date.now() + VOTO_TTL_S * 1000 },
    segredo("SESSION_SECRET"),
  );
  (await cookies()).set(VOTO_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/votar",
    maxAge: VOTO_TTL_S,
  });
  redirect(`/votar/${ctx.cicloId}`);
}

const CRITERIOS = ["didatica", "avaliacao", "pontualidade", "comunicacao"] as const;

function limpo(v: FormDataEntryValue | null, max: number): string | null {
  const t = String(v ?? "").replace(/<[^>]*>/g, "").trim().slice(0, max);
  return t === "" ? null : t;
}

/** Ecrãs 2 e 3: grava o voto cego. O turma_id e o ciclo vêm do cookie assinado, nunca do formulário. */
export async function submeterVotoAction(_: VotoState, form: FormData): Promise<VotoState> {
  const sql = getSql();
  const jar = await cookies();
  const t = verifyVoteToken(jar.get(VOTO_COOKIE)?.value ?? "", segredo("SESSION_SECRET"));
  if (!t) redirect("/votar");

  const limite = await consumir(sql, await chaveIp("voto"), LIMITE_VOTO);
  if (!limite.permitido) return { erro: "Demasiados pedidos a partir desta rede. Aguarde alguns minutos." };

  const docentes = await docentesDaTurma(sql, t.t);
  const notas: NotasDocente[] = docentes.map((d) => {
    const n = Object.fromEntries(CRITERIOS.map((c) => [c, Number(form.get(`n_${d.id}_${c}`))])) as Record<
      (typeof CRITERIOS)[number],
      number
    >;
    return { turmaDocenteId: d.id, ...n, comentario: limpo(form.get(`c_${d.id}`), 400) };
  });

  const desc = limpo(form.get("inquietacao"), 400);
  const cat = String(form.get("categoria") ?? "");
  let inquietacao: { categoria: CategoriaInquietacao; descricao: string } | null = null;
  if (desc) {
    if (!(CATEGORIAS_INQUIETACAO as readonly string[]).includes(cat)) {
      return { erro: "Escolha a categoria da inquietação." };
    }
    inquietacao = { categoria: cat as CategoriaInquietacao, descricao: desc };
  }

  const r = await submeterVoto(
    sql,
    { turmaId: t.t, cicloId: t.c, idEstudante: t.id, notas, inquietacao },
    segredo("VOTE_PEPPER"),
  );
  if (!r.ok) return { erro: r.erro };

  jar.delete({ name: VOTO_COOKIE, path: "/votar" });
  redirect("/votar/concluido");
}
