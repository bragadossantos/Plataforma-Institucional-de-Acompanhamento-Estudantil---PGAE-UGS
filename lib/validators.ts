import { z } from "zod";

/** Remove tags HTML e espaços nas pontas (defesa em profundidade contra XSS). */
export const texto = (max: number) =>
  z
    .string()
    .transform((s) => s.replace(/<[^>]*>/g, "").trim())
    .pipe(z.string().min(1).max(max));

export const loginSchema = z.object({
  identificador: z.string().trim().min(1, "Indique o identificador.").max(120),
  password: z.string().min(1, "Indique a palavra-passe.").max(200),
});

/** Mínimo 8 caracteres com letras e números (secção 4.1). */
export const novaPasswordSchema = z
  .string()
  .min(8, "Mínimo 8 caracteres.")
  .max(128, "Máximo 128 caracteres.")
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), "Use letras e números.");

export const alterarPasswordSchema = z
  .object({
    atual: z.string().min(1, "Indique a palavra-passe atual.").max(200),
    nova: novaPasswordSchema,
    confirmar: z.string().max(128),
  })
  .refine((d) => d.nova === d.confirmar, { path: ["confirmar"], message: "As palavras-passe não coincidem." })
  .refine((d) => d.nova !== d.atual, { path: ["nova"], message: "A nova palavra-passe deve ser diferente da atual." });
