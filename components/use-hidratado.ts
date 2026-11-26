"use client";

import { useSyncExternalStore } from "react";

/**
 * false até a página estar hidratada no browser (servidor e 1.º render), true depois.
 * Os botões de envio ficam inativos até lá: um clique antes disso faria o browser submeter o formulário
 * da forma clássica (GET, com os campos, incluindo palavras-passe, no endereço).
 */
export function useHidratado(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
