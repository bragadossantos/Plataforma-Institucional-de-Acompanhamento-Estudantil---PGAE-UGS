"use client";

import Link from "next/link";

// Mensagem genérica: nunca mostra detalhes técnicos ao utilizador (em produção o Next também os oculta).
export default function ErroGeral({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-4 py-10">
      <p className="font-display text-sm font-medium text-ink-muted">Erro</p>
      <h1 className="font-display text-3xl font-bold">Algo correu mal</h1>
      <p className="text-ink-muted">Não foi possível concluir o pedido. Tente novamente dentro de instantes.</p>
      <div className="flex gap-3">
        <button onClick={reset} className="min-h-11 rounded-control bg-accent px-4 font-semibold text-white">
          Tentar de novo
        </button>
        <Link href="/" className="flex min-h-11 items-center font-semibold text-brand underline">
          Início
        </Link>
      </div>
    </main>
  );
}
