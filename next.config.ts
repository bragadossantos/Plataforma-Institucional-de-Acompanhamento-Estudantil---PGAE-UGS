import type { NextConfig } from "next";

const producao = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  // Permite correr o servidor dos testes E2E ao lado do de desenvolvimento.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  poweredByHeader: false,
  reactStrictMode: true,
  // Permite forbidden() para devolver 403 real a perfis sem permissão.
  experimental: { authInterrupts: true },
  // A CSP (com nonce por pedido) vive em proxy.ts. Aqui ficam os cabeçalhos estáticos.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          ...(producao ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
        ],
      },
    ];
  },
};

export default nextConfig;
