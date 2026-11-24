"use server";

import { redirect } from "next/navigation";
import { getSession, login, logout } from "@/lib/auth";
import { homeFor } from "@/lib/rbac";
import { loginSchema } from "@/lib/validators";

export type LoginState = { erro?: string };

export async function loginAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    identificador: form.get("identificador"),
    password: form.get("password"),
  });
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const r = await login(parsed.data.identificador, parsed.data.password);
  // Mensagem única: não revela se a conta existe, está inativa ou bloqueada.
  if (!r.ok) return { erro: "Credenciais inválidas ou conta temporariamente bloqueada." };

  redirect(r.mustChangePassword ? "/alterar-palavra-passe" : homeFor(r.role));
}

export async function logoutAction(): Promise<void> {
  await logout();
  redirect("/login");
}

/** Usada pela página de login para reencaminhar quem já tem sessão. */
export async function destinoSeAutenticado(): Promise<string | null> {
  const s = await getSession();
  if (!s) return null;
  return s.mustChangePassword ? "/alterar-palavra-passe" : homeFor(s.role);
}
