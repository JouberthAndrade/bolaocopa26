import { z } from "zod";

/**
 * Validação centralizada das variáveis de ambiente.
 * Falha cedo (no boot) se algo essencial estiver faltando.
 */
const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(1),
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),
  FOOTBALL_DATA_TOKEN: z.string().min(1),
  FOOTBALL_DATA_COMPETITION_ID: z.string().default("2000"),
  // Placar ao vivo usa a API pública da ESPN (sem chave / sem quota).
  CRON_SECRET: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  // A Copa começa em 12/06/2026; o polling só faz sentido a partir do dia 11.
  // Antes disso o cron retorna cedo, sem gastar quota da API de futebol.
  POLLING_START: z
    .string()
    .datetime()
    .default("2026-06-11T00:00:00.000Z"),
});

// Em build da Vercel as envs já existem; aqui só parseia o que estiver presente.
export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  AUTH_SECRET: process.env.AUTH_SECRET,
  AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID,
  AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET,
  FOOTBALL_DATA_TOKEN: process.env.FOOTBALL_DATA_TOKEN,
  FOOTBALL_DATA_COMPETITION_ID: process.env.FOOTBALL_DATA_COMPETITION_ID,
  CRON_SECRET: process.env.CRON_SECRET,
  NEXT_PUBLIC_APP_URL:
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000"),
  POLLING_START: process.env.POLLING_START,
});

export const isGoogleAuthEnabled = Boolean(
  env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET,
);
