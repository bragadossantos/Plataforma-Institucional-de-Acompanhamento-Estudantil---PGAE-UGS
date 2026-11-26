import type { Sql } from "postgres";

// Limites da especificação (secção 4.4), por IP em hash.
// Pensados para o Wi-Fi partilhado do campus: o limite de voto é largo, o de códigos errados é rígido.
export const LIMITE_VOTO = { max: 40, janelaSeg: 10 * 60 };
export const LIMITE_CODIGO_ERRADO = { max: 5, janelaSeg: 15 * 60 };

function inicioJanela(janelaSeg: number, agora = Date.now()): Date {
  const ms = janelaSeg * 1000;
  return new Date(Math.floor(agora / ms) * ms);
}

/** Conta atual da janela sem a incrementar. */
export async function contar(sql: Sql, chave: string, janelaSeg: number): Promise<number> {
  const [r] = await sql`
    SELECT contagem FROM rate_limits
    WHERE chave = ${chave} AND janela_inicio = ${inicioJanela(janelaSeg)}`;
  return r?.contagem ?? 0;
}

/** Regista um evento e devolve a nova contagem (atómico). */
export async function registar(sql: Sql, chave: string, janelaSeg: number): Promise<number> {
  const [r] = await sql`
    INSERT INTO rate_limits (chave, janela_inicio, contagem)
    VALUES (${chave}, ${inicioJanela(janelaSeg)}, 1)
    ON CONFLICT (chave, janela_inicio) DO UPDATE SET contagem = rate_limits.contagem + 1
    RETURNING contagem`;
  // Limpeza oportunista de janelas antigas.
  if (Math.random() < 0.01) await sql`DELETE FROM rate_limits WHERE janela_inicio < NOW() - interval '1 day'`;
  return r.contagem;
}

/** Consome uma unidade: permitido se a contagem (já incluída) não passar o máximo. */
export async function consumir(
  sql: Sql,
  chave: string,
  limite: { max: number; janelaSeg: number },
): Promise<{ permitido: boolean; contagem: number }> {
  const contagem = await registar(sql, chave, limite.janelaSeg);
  return { permitido: contagem <= limite.max, contagem };
}

/** Já atingiu o máximo? (para limites que só contam falhas) */
export async function excedido(
  sql: Sql,
  chave: string,
  limite: { max: number; janelaSeg: number },
): Promise<boolean> {
  return (await contar(sql, chave, limite.janelaSeg)) >= limite.max;
}
