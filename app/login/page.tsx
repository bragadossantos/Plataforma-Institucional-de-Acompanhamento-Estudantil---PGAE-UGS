import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { destinoSeAutenticado } from "./actions";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar · PGAE" };

export default async function LoginPage() {
  const destino = await destinoSeAutenticado();
  if (destino) redirect(destino);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <header>
        <p className="font-display text-sm font-medium tracking-wide text-ink-muted">UGS · GAE</p>
        <h1 className="font-display text-3xl font-bold">Entrar</h1>
        <p className="mt-1 text-ink-muted">Acesso do GAE, liderança de turma e Observador FENT Fest.</p>
      </header>
      <LoginForm />
      <p className="text-sm text-ink-muted">
        Estudante? Não precisa de conta:{" "}
        <Link href="/votar" className="font-semibold text-brand underline">
          vote com o código da turma
        </Link>
        .
      </p>
    </main>
  );
}
