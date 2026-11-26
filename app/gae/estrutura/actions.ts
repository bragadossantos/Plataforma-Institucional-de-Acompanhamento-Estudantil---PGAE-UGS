"use server";

import { revalidatePath } from "next/cache";
import type { ZodType } from "zod";
import { logAudit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import { getSql } from "@/lib/db";
import {
  associarDocente,
  criarCurso,
  criarDocente,
  criarFaculdade,
  criarTurma,
  type Resultado,
} from "@/lib/estrutura-core";
import {
  alternarSchema,
  associacaoSchema,
  cursoSchema,
  docenteSchema,
  faculdadeSchema,
  turmaSchema,
} from "@/lib/validators";
import type { AcaoState } from "@/components/form-acao";

const PAGINA = "/gae/estrutura";

function dados(form: FormData): Record<string, FormDataEntryValue> {
  const o: Record<string, FormDataEntryValue> = {};
  for (const [k, v] of form.entries()) if (!k.startsWith("$ACTION")) o[k] = v;
  return o;
}

/**
 * Cada ação: 1) só GAE_ADMIN (requireAuth) 2) Zod 3) regra de negócio 4) auditoria.
 * Nenhum identificador de perfil ou turma é aceite do cliente fora dos campos validados.
 */
async function executar<T>(
  form: FormData,
  schema: ZodType<T>,
  acao: string,
  entidade: string,
  fn: (d: T) => Promise<Resultado>,
  mensagem: (r: Extract<Resultado, { ok: true }>) => string,
): Promise<AcaoState> {
  const s = await requireAuth(["GAE_ADMIN"]);
  const p = schema.safeParse(dados(form));
  if (!p.success) return { erro: p.error.issues[0]?.message ?? "Dados inválidos." };

  const r = await fn(p.data);
  if (!r.ok) return { erro: r.erro };

  await logAudit({ actorId: s.id, actorRole: s.role, acao, entidade, entidadeId: r.id });
  revalidatePath(PAGINA);
  return { ok: mensagem(r) };
}

export async function criarFaculdadeAction(_: AcaoState, form: FormData) {
  return executar(form, faculdadeSchema, "CRIAR_FACULDADE", "faculdade", (d) => criarFaculdade(getSql(), d), () => "Faculdade criada.");
}

export async function criarCursoAction(_: AcaoState, form: FormData) {
  return executar(form, cursoSchema, "CRIAR_CURSO", "curso", (d) => criarCurso(getSql(), d), () => "Curso criado.");
}

export async function criarTurmaAction(_: AcaoState, form: FormData) {
  return executar(
    form,
    turmaSchema,
    "CRIAR_TURMA",
    "turma",
    (d) => criarTurma(getSql(), d),
    (r) => `Turma criada. Código de acesso: ${r.extra}`,
  );
}

export async function criarDocenteAction(_: AcaoState, form: FormData) {
  return executar(form, docenteSchema, "CRIAR_DOCENTE", "docente", (d) => criarDocente(getSql(), d), () => "Docente criado.");
}

export async function associarDocenteAction(_: AcaoState, form: FormData) {
  return executar(
    form,
    associacaoSchema,
    "ASSOCIAR_DOCENTE_TURMA",
    "turma_docente",
    (d) => associarDocente(getSql(), d),
    () => "Docente associado à turma.",
  );
}

/** Ativar/desativar. Nunca se apaga: votos e auditorias referenciam estas linhas. */
async function alternar(form: FormData, tabela: "faculdades" | "cursos" | "docentes" | "turma_docentes") {
  const s = await requireAuth(["GAE_ADMIN"]);
  const p = alternarSchema.safeParse(dados(form));
  if (!p.success) return;
  const sql = getSql();
  const id = p.data.id;

  let rows: { ativo: boolean }[];
  switch (tabela) {
    case "faculdades":
      rows = await sql`UPDATE faculdades SET ativa = NOT ativa WHERE id = ${id} RETURNING ativa AS ativo`;
      break;
    case "cursos":
      rows = await sql`UPDATE cursos SET ativo = NOT ativo WHERE id = ${id} RETURNING ativo`;
      break;
    case "docentes":
      rows = await sql`UPDATE docentes SET ativo = NOT ativo WHERE id = ${id} RETURNING ativo`;
      break;
    default:
      rows = await sql`UPDATE turma_docentes SET ativo = NOT ativo WHERE id = ${id} RETURNING ativo`;
  }
  if (!rows[0]) return;

  await logAudit({
    actorId: s.id,
    actorRole: s.role,
    acao: rows[0].ativo ? "ATIVAR" : "DESATIVAR",
    entidade: tabela,
    entidadeId: id,
  });
  revalidatePath(PAGINA);
}

export async function alternarFaculdadeAction(form: FormData) {
  await alternar(form, "faculdades");
}
export async function alternarCursoAction(form: FormData) {
  await alternar(form, "cursos");
}
export async function alternarDocenteAction(form: FormData) {
  await alternar(form, "docentes");
}
export async function alternarAssociacaoAction(form: FormData) {
  await alternar(form, "turma_docentes");
}
