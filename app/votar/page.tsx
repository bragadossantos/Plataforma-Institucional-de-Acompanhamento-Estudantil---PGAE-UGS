import type { Metadata } from "next";
import { Emblema } from "@/components/logo";
import { EntradaForm } from "./entrada-form";

export const metadata: Metadata = { title: "Votar · PGAE" };

export default function VotarPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-5 px-4 py-6">
      <header className="flex items-center gap-3">
        <Emblema tamanho={52} priority />
        <div>
          <p className="font-display text-sm font-medium tracking-wide text-ink-muted">PGAE · UGS</p>
          <h1 className="font-display text-2xl font-bold leading-tight">Avaliar os docentes</h1>
        </div>
      </header>

      <div className="rounded-card bg-ok-bg p-4 text-ok" role="note">
        <p className="font-semibold">✔ Voto 100% anónimo</p>
        <p className="text-sm">O teu número serve apenas para validar que és desta turma.</p>
      </div>

      <EntradaForm />

      <p className="text-xs text-ink-muted">
        Privacidade: recolhemos apenas o necessário para a auditoria institucional (Lei n.º 22/11, Proteção de Dados
        Pessoais). O teu número não é guardado junto das tuas notas e ninguém, nem a administração, consegue ligar o
        teu nome ao teu voto.
      </p>
    </main>
  );
}
