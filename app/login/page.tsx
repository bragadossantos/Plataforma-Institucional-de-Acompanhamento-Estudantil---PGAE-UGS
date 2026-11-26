import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoCompleto } from "@/components/logo";
import { destinoSeAutenticado } from "./actions";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar · PGAE" };

export default async function LoginPage() {
  const destino = await destinoSeAutenticado();
  if (destino) redirect(destino);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-6 px-4 py-10">
      <header className="flex flex-col items-center text-center">
        <LogoCompleto largura={176} priority />
        <h1 className="mt-5 font-display text-3xl font-bold">PGAE</h1>
        <p className="mt-1 font-semibold">Plataforma Institucional de Acompanhamento Estudantil</p>
        <p className="mt-2 text-sm text-ink-muted">
          Avaliação docente anónima, auditoria de sala de aula e acompanhamento académico, do Grupo de Acompanhamento
          Estudantil (GAE).
        </p>
      </header>

      <div className="w-full rounded-card border border-border bg-surface p-5">
        <h2 className="mb-4 text-center font-display text-lg font-bold">Entrar</h2>
        <LoginForm />
        <p className="mt-3 text-center text-xs text-ink-muted">GAE, liderança de turma e Observador.</p>
      </div>

      <p className="text-center text-sm text-ink-muted">
        Estudante? Não precisa de conta:{" "}
        <Link href="/votar" className="font-semibold text-brand underline">
          vote com o código da turma
        </Link>
        .
      </p>
    </main>
  );
}
