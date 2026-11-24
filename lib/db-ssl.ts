/** TLS obrigatório em qualquer base remota (Neon). Só desligado para a base local de desenvolvimento. */
export function isLocalDatabase(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

export function sslFor(url: string): "require" | false {
  return isLocalDatabase(url) ? false : "require";
}
