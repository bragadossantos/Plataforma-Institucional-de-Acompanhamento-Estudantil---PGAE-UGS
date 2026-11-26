import Image from "next/image";

/** Logótipo completo da UGS (emblema + nome), com fundo transparente. Para fundos claros. */
export function LogoCompleto({ largura = 200, priority = false }: { largura?: number; priority?: boolean }) {
  return (
    <Image
      src="/brand/ugs-logo.png"
      alt="Universidade Gregório Semedo"
      width={720}
      height={742}
      priority={priority}
      sizes={`${largura}px`}
      style={{ width: largura, height: "auto" }}
    />
  );
}

/** Emblema da UGS, com fundo transparente. Serve em fundos claros e escuros. */
export function Emblema({ tamanho = 40, priority = false }: { tamanho?: number; priority?: boolean }) {
  return (
    <Image
      src="/brand/ugs-emblema.png"
      alt="Emblema da Universidade Gregório Semedo"
      width={512}
      height={512}
      priority={priority}
      sizes={`${tamanho}px`}
      style={{ width: tamanho, height: tamanho }}
    />
  );
}
