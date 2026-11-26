"use server";

import { redirect } from "next/navigation";
import { changePassword, requireAuth } from "@/lib/auth";
import { homeFor } from "@/lib/rbac";
import { alterarPasswordSchema } from "@/lib/validators";

export type AlterarState = { erros?: Record<string, string>; geral?: string };

export async function alterarPasswordAction(_prev: AlterarState, form: FormData): Promise<AlterarState> {
  const s = await requireAuth(undefined, { allowPasswordChange: true });

  const parsed = alterarPasswordSchema.safeParse({
    atual: form.get("atual"),
    nova: form.get("nova"),
    confirmar: form.get("confirmar"),
  });
  if (!parsed.success) {
    const erros: Record<string, string> = {};
    for (const i of parsed.error.issues) erros[String(i.path[0])] ??= i.message;
    return { erros };
  }

  const ok = await changePassword(s, parsed.data.atual, parsed.data.nova);
  if (!ok) return { erros: { atual: "Palavra-passe atual incorreta." } };

  redirect(homeFor(s.role));
}
