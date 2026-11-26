import { randomInt } from "node:crypto";

// Sem caracteres ambíguos (0/O, 1/I/L) para facilitar a leitura no telemóvel.
const ALFABETO = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** Código de acesso da turma, ex.: `EI3A-7K9P` (máx. 16 caracteres, coluna codigo_acesso). */
export function gerarCodigoTurma(cursoCodigo: string, ano: number, designacao: string): string {
  const prefixo = `${cursoCodigo.toUpperCase().replace(/[^A-Z0-9]/g, "")}${ano}${designacao}`.slice(0, 10);
  let sufixo = "";
  for (let i = 0; i < 4; i++) sufixo += ALFABETO[randomInt(ALFABETO.length)];
  return `${prefixo}-${sufixo}`;
}
