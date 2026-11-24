import { NextResponse, type NextRequest } from "next/server";
import { verifySession } from "./lib/session-token.ts";

// Verificação otimista (assinatura e validade do cookie), sem base de dados.
// A autorização real (perfil, conta ativa, session_version) é feita no servidor por requireAuth().
export function proxy(request: NextRequest) {
  const token = request.cookies.get("pgae_session")?.value;
  const secret = process.env.SESSION_SECRET;
  const valido = Boolean(token && secret && verifySession(token, secret));
  if (valido) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/gae/:path*", "/delegado/:path*", "/insights/:path*", "/api/export/:path*", "/alterar-palavra-passe"],
};
