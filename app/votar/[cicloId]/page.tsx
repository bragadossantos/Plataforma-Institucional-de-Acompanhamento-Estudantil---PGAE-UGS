import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSql } from "@/lib/db";
import { VOTO_COOKIE } from "@/lib/vote-cookie";
import { verifyVoteToken } from "@/lib/vote-token";
import { docentesDaTurma } from "@/lib/vote-core";
import { Emblema } from "@/components/logo";
import { VotoForm } from "./voto-form";

export const metadata: Metadata = { title: "Avaliação anónima · PGAE" };

export default async function VotoPage({ params }: { params: Promise<{ cicloId: string }> }) {
  const { cicloId } = await params;
  const secret = process.env.SESSION_SECRET ?? "";
  const token = verifyVoteToken((await cookies()).get(VOTO_COOKIE)?.value ?? "", secret);
  // Sem testemunho válido, ou de outro ciclo: volta ao ecrã 1.
  if (!token || String(token.c) !== cicloId) redirect("/votar");

  const docentes = await docentesDaTurma(getSql(), token.t);
  if (docentes.length === 0) redirect("/votar");

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 py-6">
      <div className="mb-4 flex items-center gap-2">
        <Emblema tamanho={36} priority />
        <span className="font-display text-sm font-medium tracking-wide text-ink-muted">PGAE · UGS</span>
      </div>
      <VotoForm docentes={docentes.map((d) => ({ id: d.id, disciplina: d.disciplina, nome: d.nome }))} />
    </main>
  );
}
