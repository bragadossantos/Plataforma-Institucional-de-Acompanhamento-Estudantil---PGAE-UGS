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

// ---------------------------------------------------------------------
// Estrutura académica (GAE_ADMIN)
// ---------------------------------------------------------------------
const idPositivo = z.coerce.number().int().positive("Selecione uma opção.");

export const faculdadeSchema = z.object({
  nome: texto(150),
  sigla: texto(20).pipe(z.string().regex(/^[A-Za-z0-9-]+$/, "Sigla: só letras, números e hífen.")),
});

export const cursoSchema = z.object({
  faculdadeId: idPositivo,
  nome: texto(150),
  codigo: texto(20).pipe(z.string().regex(/^[A-Za-z0-9]+$/, "Código: só letras e números.")),
});

export const turmaSchema = z.object({
  cursoId: idPositivo,
  ano: z.coerce.number().int().min(1, "Ano de 1 a 5.").max(5, "Ano de 1 a 5."),
  designacao: z.enum(["A", "B", "C", "D"], "Turma: A, B, C ou D."),
  periodo: z.enum(["MANHA", "TARDE", "NOITE"], "Selecione o período."),
  semestre: texto(20).pipe(z.string().regex(/^\d{4}-S[12]$/, "Formato do semestre: 2026-S2.")),
  totalEstimado: z.coerce.number().int().min(5, "Mínimo 5 alunos.").max(150, "Máximo 150 alunos."),
});

const opcional = (max: number) =>
  z
    .string()
    .transform((s) => s.replace(/<[^>]*>/g, "").trim())
    .pipe(z.string().max(max))
    .transform((s) => (s === "" ? null : s));

export const docenteSchema = z.object({
  nome: texto(150),
  codigo: opcional(40),
  grau: opcional(40),
});

export const associacaoSchema = z.object({
  turmaId: idPositivo,
  docenteId: idPositivo,
  disciplina: texto(150),
});

export const alternarSchema = z.object({ id: idPositivo });
