import { NextResponse, type NextRequest } from "next/server";
import { verifySession } from "./lib/session-token.ts";

const PROTEGIDAS = ["/gae", "/delegado", "/insights", "/api/export", "/alterar-palavra-passe"];

const dentro = (path: string, prefixo: string) => path === prefixo || path.startsWith(`${prefixo}/`);

/** CSP com nonce por pedido (secção 4.4). Em desenvolvimento o React precisa de 'unsafe-eval' e do websocket do HMR. */
function politicaCsp(nonce: string): string {
  const dev = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // Estilos inline: o React usa style="…" (ex.: largura das barras). Os scripts é que são estritos.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${dev ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // 1) Verificação otimista do cookie nas rotas protegidas (a autorização real é feita por requireAuth/authApi).
  if (PROTEGIDAS.some((p) => dentro(path, p))) {
    const token = request.cookies.get("pgae_session")?.value;
    const secret = process.env.SESSION_SECRET;
    const valido = Boolean(token && secret && verifySession(token, secret));
    if (!valido) {
      if (path.startsWith("/api/")) {
        return NextResponse.json({ erro: "Não autenticado." }, { status: 401, headers: { "Cache-Control": "no-store" } });
      }
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // 2) CSP com nonce: o Next lê o nonce do cabeçalho do pedido e aplica-o aos seus scripts.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = politicaCsp(nonce);
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Tudo menos ficheiros estáticos e pré-carregamentos.
      source: "/((?!_next/static|_next/image|favicon.ico|robots.txt).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
