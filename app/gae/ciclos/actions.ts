"use server";

import { revalidatePath } from "next/cache";
import type { AcaoState } from "@/components/form-acao";
import { logAudit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import {
  abrirCiclo,
  alternarCodigoAtivo,
  criarCiclo,
  encerrarCiclo,
  rodarCodigo,
  type Res,
} from "@/lib/ciclos-core";
import { getSql } from "@/lib/db";
import { GAE_ROLES } from "@/lib/rbac";
import { alternarSchema, cicloSchema } from "@/lib/validators";

const PAGINA = "/gae/ciclos";

function dados(form: FormData): Record<string, FormDataEntryValue> {
  const o: Record<string, FormDataEntryValue> = {};
  for (const [k, v] of form.entries()) if (!k.startsWith("$ACTION")) o[k] = v;
  return o;
}

export async function criarCicloAction(_: AcaoState, form: FormData): Promise<AcaoState> {
  const s = await requireAuth(GAE_ROLES);
  const p = cicloSchema.safeParse(dados(form));
  if (!p.success) return { erro: p.error.issues[0]?.message ?? "Dados inválidos." };
  const r = await criarCiclo(getSql(), p.data, s.id);
  if (!r.ok) return { erro: r.erro };
  await logAudit({ actorId: s.id, actorRole: s.role, acao: "CRIAR_CICLO", entidade: "ciclo", entidadeId: r.id });
  revalidatePath(PAGINA);
  return { ok: "Ciclo criado em rascunho. Abra-o quando quiser iniciar a votação." };
}

async function sobreId(
  form: FormData,
  acao: string,
  entidade: string,
  fn: (id: number) => Promise<Res & { ativo?: boolean }>,
  msg: (r: Extract<Res, { ok: true }> & { ativo?: boolean }) => string,
  acaoDe?: (r: Extract<Res, { ok: true }> & { ativo?: boolean }) => string,
): Promise<AcaoState> {
  const s = await requireAuth(GAE_ROLES);
  const p = alternarSchema.safeParse(dados(form));
  if (!p.success) return { erro: "Pedido inválido." };
  const r = await fn(p.data.id);
  if (!r.ok) return { erro: r.erro };
  await logAudit({
    actorId: s.id,
    actorRole: s.role,
    acao: acaoDe ? acaoDe(r) : acao,
    entidade,
    entidadeId: p.data.id,
  });
  revalidatePath(PAGINA);
  return { ok: msg(r) };
}

export async function abrirCicloAction(_: AcaoState, form: FormData) {
  return sobreId(form, "ABRIR_CICLO", "ciclo", (id) => abrirCiclo(getSql(), id), (r) => `Ciclo aberto. ${r.extra ?? ""}`);
}

export async function encerrarCicloAction(_: AcaoState, form: FormData) {
  return sobreId(form, "ENCERRAR_CICLO", "ciclo", (id) => encerrarCiclo(getSql(), id), () => "Ciclo encerrado.");
}

export async function rodarCodigoAction(_: AcaoState, form: FormData) {
  return sobreId(
    form,
    "RODAR_CODIGO_TURMA",
    "turma",
    (id) => rodarCodigo(getSql(), id),
    (r) => `Novo código: ${r.extra}. O anterior deixou de funcionar.`,
  );
}

export async function alternarCodigoAction(_: AcaoState, form: FormData) {
  return sobreId(
    form,
    "",
    "turma",
    (id) => alternarCodigoAtivo(getSql(), id),
    (r) => (r.ativo ? "Código ativado." : "Código desativado: ninguém consegue votar com ele."),
    (r) => (r.ativo ? "ATIVAR_CODIGO_TURMA" : "DESATIVAR_CODIGO_TURMA"),
  );
}
