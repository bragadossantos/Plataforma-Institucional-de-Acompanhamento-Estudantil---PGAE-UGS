import { logAudit } from "@/lib/audit";
import { authApi } from "@/lib/auth-api";
import { getSql } from "@/lib/db";
import { filtrosDeQuery, nomeFicheiro } from "@/lib/export-params";
import { GAE_ROLES } from "@/lib/rbac";
import { montarRelatorio, paraPdf } from "@/lib/relatorio";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const a = await authApi(GAE_ROLES);
  if (!a.ok) return a.response;

  const f = filtrosDeQuery(new URL(request.url).searchParams);
  if (!f) return Response.json({ erro: "Indique o ciclo (?ciclo=)." }, { status: 400 });

  const r = await montarRelatorio(getSql(), f);
  if (!r) return Response.json({ erro: "Ciclo não encontrado." }, { status: 404 });

  await logAudit({
    actorId: a.user.id,
    actorRole: a.user.role,
    acao: "EXPORTAR_PDF_DIRECAO",
    entidade: "ciclo",
    entidadeId: f.cicloId,
    metadados: { faculdadeId: f.faculdadeId, cursoId: f.cursoId, turmaId: f.turmaId, linhas: r.ranking.length },
  });

  const bytes = await paraPdf(r);
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nomeFicheiro("pgae-relatorio-direcao", "pdf")}"`,
      "Cache-Control": "no-store",
    },
  });
}
