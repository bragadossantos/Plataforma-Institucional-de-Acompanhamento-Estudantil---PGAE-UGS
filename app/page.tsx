import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4 py-10">
      <header>
        <p className="font-display text-sm font-medium tracking-wide text-ink-muted">UGS · GAE</p>
        <h1 className="font-display text-3xl font-bold">PGAE</h1>
        <p className="mt-1 text-ink-muted">Plataforma Institucional de Acompanhamento Estudantil</p>
      </header>

      <div className="flex flex-col gap-3">
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

      <p className="text-sm text-ink-muted">
        Em construção · Fase 1. Veja o catálogo visual em{" "}
        <Link href="/design" className="font-semibold text-brand underline">
          /design
        </Link>
        .
      </p>
    </main>
  );
}
