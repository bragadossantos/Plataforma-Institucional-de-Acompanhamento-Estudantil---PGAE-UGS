import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { requireAuth } from "@/lib/auth";
import { GAE_ROLES } from "@/lib/rbac";

export const metadata: Metadata = { title: "Painel GAE · PGAE" };

export default async function GaePage() {
  const user = await requireAuth(GAE_ROLES);
  return (
    <AppShell user={user} current="/gae" title="Painel GAE">
      <p className="max-w-prose text-ink-muted">
        O dashboard de BI chega na Fase 3. Nesta fase está disponível a estrutura académica e a gestão de
        utilizadores.
      </p>
    </AppShell>
  );
}
