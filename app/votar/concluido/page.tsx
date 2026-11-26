import type { Metadata } from "next";
import { Emblema } from "@/components/logo";

export const metadata: Metadata = { title: "Obrigado · PGAE" };

export default function Concluido() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-4 py-10 text-center">
      <Emblema tamanho={88} priority />
      <p className="text-5xl text-ok" aria-hidden="true">
        ✔
      </p>
      <h1 className="font-display text-3xl font-bold">Obrigado!</h1>
      <p className="text-ink-muted">A tua avaliação foi registada de forma anónima. Já podes fechar esta página.</p>
    </main>
  );
}
