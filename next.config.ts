import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Permite forbidden() para devolver 403 real a perfis sem permissão.
  experimental: { authInterrupts: true },
};

export default nextConfig;
