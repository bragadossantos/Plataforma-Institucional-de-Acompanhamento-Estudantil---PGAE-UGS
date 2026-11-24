"use server";

import { revalidatePath } from "next/cache";
import type { AcaoState } from "@/components/form-acao";
import { logAudit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { GAE_ROLES } from "@/lib/rbac";
import { alterarEstado, definirFentFest, definirInquietacaoVisivel, type Estado } from "@/lib/triagem-core";
import { estadoAuditoriaSchema, fentAuditoriaSchema, inquietacaoVisivelSchema } from "@/lib/validators";

function dados(form: FormData): Record<string, FormDataEntryValue> {
  const o: Record<string, FormDataEntryValue> = {};
  for (const [k, v] of form.entries()) if (!k.startsWith("$ACTION")) o[k] = v;
  return o;
}

function refrescar() {
  revalidatePath("/gae/auditorias");
  revalidatePath("/gae");
  revalidatePath("/insights");
}

export async function alterarEstadoAction(_: AcaoState, form: FormData): Promise<AcaoState> {
  const s = await requireAuth(GAE_ROLES);
  const p = estadoAuditoriaSchema.safeParse(dados(form));
  if (!p.success) return { erro: p.error.issues[0]?.message ?? "Dados inválidos." };

  const r = await alterarEstado(getSql(), p.data.id, p.data.estado as Estado, p.data.parecer);
  if (!r.ok) return { erro: r.erro };

  await logAudit({
    actorId: s.id,
    actorRole: s.role,
    acao: "ALTERAR_ESTADO_OCORRENCIA",
    entidade: "auditoria_sala",
    entidadeId: p.data.id,
    metadados: { estado: p.data.estado },
  });
  refrescar();
  return { ok: "Estado atualizado." };
}

export async function definirFentAction(_: AcaoState, form: FormData): Promise<AcaoState> {
  const s = await requireAuth(GAE_ROLES);
  const p = fentAuditoriaSchema.safeParse(dados(form));
  if (!p.success) return { erro: p.error.issues[0]?.message ?? "Dados inválidos." };

  const r = await definirFentFest(getSql(), p.data.id, p.data.ativo, p.data.resumo);
  if (!r.ok) return { erro: r.erro };

  await logAudit({
    actorId: s.id,
    actorRole: s.role,
    acao: p.data.ativo ? "ENVIAR_PARA_BANCO_DESAFIOS" : "RETIRAR_DO_BANCO_DESAFIOS",
    entidade: "auditoria_sala",
    entidadeId: p.data.id,
  });
  refrescar();
  return { ok: p.data.ativo ? "Enviado para o Banco de Desafios." : "Retirado do Banco de Desafios." };
}

export async function definirInquietacaoAction(_: AcaoState, form: FormData): Promise<AcaoState> {
  const s = await requireAuth(GAE_ROLES);
  const p = inquietacaoVisivelSchema.safeParse(dados(form));
  if (!p.success) return { erro: "Pedido inválido." };

  const r = await definirInquietacaoVisivel(getSql(), p.data.id, p.data.visivel);
  if (!r.ok) return { erro: r.erro };

  await logAudit({
    actorId: s.id,
    actorRole: s.role,
    acao: p.data.visivel ? "APROVAR_INQUIETACAO" : "RETIRAR_INQUIETACAO",
    entidade: "inquietacao",
    entidadeId: p.data.id,
  });
  refrescar();
  return { ok: p.data.visivel ? "Aprovada para o Banco de Desafios." : "Retirada do Banco de Desafios." };
}
