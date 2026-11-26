import Link from "next/link";
import { LogoCompleto } from "@/components/logo";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-6 px-4 py-10 text-center">
      <header className="flex flex-col items-center">
        <LogoCompleto largura={200} priority />
        <h1 className="mt-5 font-display text-3xl font-bold">PGAE</h1>
        <p className="mt-1 font-semibold">Plataforma Institucional de Acompanhamento Estudantil</p>
        <p className="mt-2 text-sm text-ink-muted">
          Avaliação docente anónima, auditoria de sala de aula e acompanhamento académico, do Grupo de Acompanhamento
          Estudantil (GAE).
        </p>
      </header>

      <div className="flex w-full flex-col gap-3">
        <Link
          href="/votar"
          className="flex min-h-11 items-center justify-center rounded-control bg-accent px-4 font-semibold text-white"
        >
          Votar com código de turma
        </Link>
        <Link
          href="/login"
          className="flex min-h-11 items-center justify-center rounded-control border border-border bg-surface px-4 font-semibold"
        >
          Entrar (GAE e liderança de turma)
        </Link>
      </div>
    </main>
  );
}
