import { z } from "zod";

// ─── Auth ───
export const registerSchema = z
  .object({
    name: z.string().min(2, "Nome muito curto").max(60),
    email: z.string().email("E-mail inválido"),
    password: z.string().min(8, "Mínimo de 8 caracteres").max(72),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "As senhas não conferem",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Informe a senha"),
});

// ─── Pool ───
export const prizeTierSchema = z.object({
  position: z.number().int().positive(),
  percentage: z.number().min(0).max(100),
});

export const createPoolSchema = z
  .object({
    name: z.string().min(3, "Mínimo de 3 caracteres").max(60),
    slug: z
      .string()
      .min(3)
      .max(30)
      .regex(/^[A-Z0-9]+$/, "Use apenas letras maiúsculas e números"),
    description: z.string().max(280).optional().or(z.literal("")),
    stakeAmount: z.number().min(0).default(0),
    currency: z.string().length(3).default("BRL"),
    entryDeadline: z.coerce.date().optional(),
    betsVisibility: z.enum(["HIDDEN", "OPEN", "AFTER_LOCK"]).default("AFTER_LOCK"),
    // regras de pontuação
    pointsExactScore: z.number().int().min(0).max(100).default(1),
    pointsCorrectResult: z.number().int().min(0).max(100).default(3),
    pointsCorrectDraw: z.number().int().min(0).max(100).default(2),
    championBonus: z.number().int().min(0).max(100).default(5),
    runnerUpBonus: z.number().int().min(0).max(100).default(3),
    topScorerBonus: z.number().int().min(0).max(100).default(5),
    // premiação
    prizeTiers: z.array(prizeTierSchema).min(1),
  })
  .refine(
    (d) => Math.round(d.prizeTiers.reduce((s, t) => s + t.percentage, 0)) === 100,
    { message: "A soma das premiações deve ser 100%", path: ["prizeTiers"] },
  );

// ─── Bet ───
export const betSchema = z.object({
  poolId: z.string().min(1),
  matchId: z.string().min(1),
  homeGuess: z.number().int().min(0).max(99),
  awayGuess: z.number().int().min(0).max(99),
});

export const championBetSchema = z.object({
  poolId: z.string().min(1),
  champTeamId: z.string().optional(),
  runnerUpTeamId: z.string().optional(),
  topScorerName: z.string().max(80).optional(),
});

export const joinPoolSchema = z.object({
  code: z.string().min(3).max(40),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type CreatePoolInput = z.infer<typeof createPoolSchema>;
export type BetInput = z.infer<typeof betSchema>;
