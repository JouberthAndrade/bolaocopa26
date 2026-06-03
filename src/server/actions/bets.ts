"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUserId, requireMembership } from "@/server/guards";
import { isGroupStageComplete } from "@/server/services/matches";
import { betSchema, championBetSchema } from "@/lib/validations";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Registra/edita um palpite de placar.
 * O travamento (30 min antes) é validado SEMPRE no servidor,
 * nunca confiando no relógio do cliente.
 */
export async function upsertBet(input: unknown): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = betSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Palpite inválido" };
  }
  const { poolId, matchId, homeGuess, awayGuess } = parsed.data;

  await requireMembership(poolId, userId);

  const match = await db.match.findUnique({
    where: { id: matchId },
    select: { lockAt: true, status: true, stage: true },
  });
  if (!match) return { ok: false, error: "Jogo não encontrado" };

  // Fases finais só abrem após o término da fase de grupos.
  if (match.stage !== "GROUP" && !(await isGroupStageComplete())) {
    return { ok: false, error: "Os palpites das fases finais abrem após a fase de grupos" };
  }

  if (new Date() >= match.lockAt || match.status !== "SCHEDULED") {
    return { ok: false, error: "Palpites encerrados para este jogo" };
  }

  await db.bet.upsert({
    where: { userId_poolId_matchId: { userId, poolId, matchId } },
    update: { homeGuess, awayGuess },
    create: { userId, poolId, matchId, homeGuess, awayGuess },
  });

  revalidatePath("/");
  return { ok: true, data: undefined };
}

/** Palpite de campeão/vice/artilheiro (bônus), travado pelo entryDeadline do bolão. */
export async function upsertChampionBet(input: unknown): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = championBetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const { poolId, champTeamId, runnerUpTeamId, topScorerName } = parsed.data;

  await requireMembership(poolId, userId);

  const pool = await db.pool.findUnique({
    where: { id: poolId },
    select: { entryDeadline: true },
  });
  if (pool?.entryDeadline && new Date() >= pool.entryDeadline) {
    return { ok: false, error: "Prazo para palpite de campeão encerrado" };
  }

  await db.championBet.upsert({
    where: { userId_poolId: { userId, poolId } },
    update: { champTeamId, runnerUpTeamId, topScorerName },
    create: { userId, poolId, champTeamId, runnerUpTeamId, topScorerName },
  });

  return { ok: true, data: undefined };
}
