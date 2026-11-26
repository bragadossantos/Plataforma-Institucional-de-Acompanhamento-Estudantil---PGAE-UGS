import type { Metadata } from "next";
import { Emblema } from "@/components/logo";
import { requireAuth } from "@/lib/auth";
import { AlterarForm } from "./alterar-form";

export const metadata: Metadata = { title: "Alterar palavra-passe · PGAE" };

export default async function AlterarPasswordPage() {
  const s = await requireAuth(undefined, { allowPasswordChange: true });
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <header>
        <Emblema tamanho={56} priority />
        <h1 className="mt-3 font-display text-3xl font-bold">Defina a sua palavra-passe</h1>
        <p className="mt-1 text-ink-muted">
          {s.mustChangePassword
            ? "Por segurança, a palavra-passe provisória tem de ser trocada antes de continuar."
            : "Escolha uma nova palavra-passe."}
        </p>
      </header>
      <AlterarForm />
    </main>
  );
}
