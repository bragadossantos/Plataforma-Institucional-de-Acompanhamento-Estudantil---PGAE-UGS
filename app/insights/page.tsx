import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { requireAuth } from "@/lib/auth";

export const metadata: Metadata = { title: "Desafios · PGAE" };

export default async function InsightsPage() {
  // Perfis com acesso a /insights: FENT_OBSERVER e GAE_ADMIN (secção 2.3 da especificação).
  const user = await requireAuth(["FENT_OBSERVER", "GAE_ADMIN"]);
  return (
    <AppShell user={user} current="/insights" title="Banco de Desafios">
      <p className="max-w-prose text-ink-muted">
        Problemas e inquietações anonimizados e aprovados pelo GAE. O conteúdo chega na Fase 3.
      </p>
    </AppShell>
  );
}
