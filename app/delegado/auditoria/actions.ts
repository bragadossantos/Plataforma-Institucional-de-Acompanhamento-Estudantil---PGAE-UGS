"use server";

import { revalidatePath } from "next/cache";
import { forbidden } from "next/navigation";
import type { AcaoState } from "@/components/form-acao";
import { logAudit } from "@/lib/audit";
import { registarAuditoria } from "@/lib/auditoria-core";
import { requireAuth } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { LIDERANCA_ROLES } from "@/lib/rbac";
import { auditoriaSchema } from "@/lib/validators";

export async function registarAuditoriaAction(_: AcaoState, form: FormData): Promise<AcaoState> {
  const s = await requireAuth(LIDERANCA_ROLES);
  // A turma vem da sessão. Qualquer turma_id enviado pelo cliente é ignorado (T2).
  if (s.turmaId === null) return { erro: "A sua conta não tem turma associada." };

  const raw: Record<string, FormDataEntryValue> = {};
  for (const [k, v] of form.entries()) if (!k.startsWith("$ACTION")) raw[k] = v;
  const p = auditoriaSchema.safeParse(raw);
  if (!p.success) return { erro: p.error.issues[0]?.message ?? "Dados inválidos." };

  const r = await registarAuditoria(getSql(), {
    turmaId: s.turmaId,
    autorId: s.id,
    turmaDocenteId: p.data.turmaDocenteId,
    categoria: p.data.categoria,
    gravidade: p.data.gravidade,
    titulo: p.data.titulo,
    descricao: p.data.descricao,
  });

  if (!r.ok) {
    if (r.fora_do_escopo) {
      await logAudit({
        actorId: s.id,
        actorRole: s.role,
        acao: "ACESSO_NEGADO",
        entidade: "turma_docente",
        entidadeId: p.data.turmaDocenteId,
        metadados: { motivo: "fora_do_escopo" },
      });
      forbidden();
    }
    return { erro: r.erro };
  }

  await logAudit({
    actorId: s.id,
    actorRole: s.role,
    acao: "REGISTAR_AUDITORIA_SALA",
    entidade: "auditoria_sala",
    entidadeId: r.id,
    metadados: { gravidade: p.data.gravidade, categoria: p.data.categoria },
  });
  revalidatePath("/delegado/auditoria");
  revalidatePath("/gae/auditorias");
  return { ok: "Ocorrência registada e enviada ao GAE." };
}
