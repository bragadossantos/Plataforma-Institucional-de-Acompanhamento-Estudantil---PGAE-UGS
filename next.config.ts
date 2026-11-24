import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permite correr o servidor dos testes E2E ao lado do de desenvolvimento.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  poweredByHeader: false,
  reactStrictMode: true,
  // Permite forbidden() para devolver 403 real a perfis sem permissão.
  experimental: { authInterrupts: true },
};

export default nextConfig;
