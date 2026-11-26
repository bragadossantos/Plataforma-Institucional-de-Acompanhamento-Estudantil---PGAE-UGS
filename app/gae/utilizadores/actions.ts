"use server";

import { revalidatePath } from "next/cache";
import type { AcaoState } from "@/components/form-acao";
import { logAudit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { alternarAtivo, criarUtilizador, redefinirPassword } from "@/lib/utilizadores-core";
import { alternarSchema, utilizadorSchema } from "@/lib/validators";

const PAGINA = "/gae/utilizadores";

function dados(form: FormData): Record<string, FormDataEntryValue> {
  const o: Record<string, FormDataEntryValue> = {};
  for (const [k, v] of form.entries()) if (!k.startsWith("$ACTION")) o[k] = v;
  return o;
}

// Todas as ações: só GAE_ADMIN. A palavra-passe provisória é devolvida uma única vez e nunca é registada.

export async function criarUtilizadorAction(_: AcaoState, form: FormData): Promise<AcaoState> {
  const s = await requireAuth(["GAE_ADMIN"]);
  const p = utilizadorSchema.safeParse(dados(form));
  if (!p.success) return { erro: p.error.issues[0]?.message ?? "Dados inválidos." };

  const r = await criarUtilizador(getSql(), p.data, s.id);
  if (!r.ok) return { erro: r.erro };

  await logAudit({
    actorId: s.id,
    actorRole: s.role,
    acao: "CRIAR_UTILIZADOR",
    entidade: "utilizador",
    entidadeId: r.id,
    metadados: { perfil: p.data.role, turmaId: p.data.turmaId },
  });
  revalidatePath(PAGINA);
  return { ok: `Utilizador criado. Palavra-passe provisória: ${r.senha} (só é mostrada agora; terá de a trocar no 1.º acesso).` };
}

export async function alternarUtilizadorAction(_: AcaoState, form: FormData): Promise<AcaoState> {
  const s = await requireAuth(["GAE_ADMIN"]);
  const p = alternarSchema.safeParse(dados(form));
  if (!p.success) return { erro: "Pedido inválido." };

  const r = await alternarAtivo(getSql(), p.data.id, s.id);
  if (!r.ok) return { erro: r.erro };

  await logAudit({
    actorId: s.id,
    actorRole: s.role,
    acao: r.ativo ? "ATIVAR_UTILIZADOR" : "DESATIVAR_UTILIZADOR",
    entidade: "utilizador",
    entidadeId: p.data.id,
  });
  revalidatePath(PAGINA);
  return { ok: r.ativo ? "Conta ativada." : "Conta desativada; sessões revogadas." };
}

export async function redefinirPasswordAction(_: AcaoState, form: FormData): Promise<AcaoState> {
  const s = await requireAuth(["GAE_ADMIN"]);
  const p = alternarSchema.safeParse(dados(form));
  if (!p.success) return { erro: "Pedido inválido." };

  const r = await redefinirPassword(getSql(), p.data.id);
  if (!r.ok) return { erro: r.erro };

  await logAudit({
    actorId: s.id,
    actorRole: s.role,
    acao: "REDEFINIR_PASSWORD",
    entidade: "utilizador",
    entidadeId: p.data.id,
  });
  revalidatePath(PAGINA);
  return { ok: `Nova palavra-passe provisória: ${r.senha} (só é mostrada agora).` };
}
