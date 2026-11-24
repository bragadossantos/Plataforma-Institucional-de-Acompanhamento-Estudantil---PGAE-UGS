import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSql } from "@/lib/db";
import { VOTO_COOKIE } from "@/lib/vote-cookie";
import { verifyVoteToken } from "@/lib/vote-token";
import { docentesDaTurma } from "@/lib/vote-core";
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
      <VotoForm docentes={docentes.map((d) => ({ id: d.id, disciplina: d.disciplina, nome: d.nome }))} />
    </main>
  );
}
