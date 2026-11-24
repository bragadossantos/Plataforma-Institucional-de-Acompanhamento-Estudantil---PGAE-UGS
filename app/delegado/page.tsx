import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { requireAuth } from "@/lib/auth";
import { LIDERANCA_ROLES } from "@/lib/rbac";

export const metadata: Metadata = { title: "Painel da turma · PGAE" };

export default async function DelegadoPage() {
  const user = await requireAuth(LIDERANCA_ROLES);
  return (
    <AppShell user={user} current="/delegado" title="Painel da turma">
      <p className="max-w-prose text-ink-muted">
        O código da turma, a taxa de adesão e a auditoria de sala de aula chegam na Fase 2.
      </p>
    </AppShell>
  );
}
