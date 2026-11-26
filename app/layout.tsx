import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { IBM_Plex_Mono, IBM_Plex_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-plex-sans",
  display: "swap",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PGAE · UGS",
  description:
    "Plataforma Institucional de Acompanhamento Estudantil — GAE, Universidade Gregório Semedo.",
  // Ferramenta institucional: não deve aparecer nos motores de pesquisa.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#10162b",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Ler os cabeçalhos torna todas as páginas dinâmicas, o que o Next exige para aplicar o nonce da CSP.
  await headers();
  return (
    <html
      lang="pt-AO"
      className={`${spaceGrotesk.variable} ${plexSans.variable} ${plexMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
