"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUserId, requireMembership } from "@/server/guards";
import { isBetClosed, isKnockoutDraw } from "@/lib/bet-gate";
import { betSchema, championBetSchema } from "@/lib/validations";
import { bonusDeadlineFor } from "@/lib/constants";
import { getBonusResults, type BonusResults } from "@/server/services/bonus";

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
  const { poolId, matchId, homeGuess, awayGuess, advances } = parsed.data;

  await requireMembership(poolId, userId);

  const match = await db.match.findUnique({
    where: { id: matchId },
    select: { lockAt: true, status: true, stage: true },
  });
  if (!match) return { ok: false, error: "Jogo não encontrado" };

  if (isBetClosed(match)) {
    return { ok: false, error: "Palpites encerrados para este jogo" };
  }

  const knockoutDraw = isKnockoutDraw(match.stage, homeGuess, awayGuess);
  if (knockoutDraw && !advances) {
    return { ok: false, error: "Escolha quem avança nos pênaltis" };
  }
  // Só persiste o pick em empate de mata-mata; nos demais casos, limpa.
  const advancesToStore = knockoutDraw ? advances! : null;

  await db.bet.upsert({
    where: { userId_poolId_matchId: { userId, poolId, matchId } },
    update: { homeGuess, awayGuess, advances: advancesToStore },
    create: { userId, poolId, matchId, homeGuess, awayGuess, advances: advancesToStore },
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
  const bonusDeadline = bonusDeadlineFor(pool?.entryDeadline);
  if (new Date() >= bonusDeadline) {
    const fmt = bonusDeadline.toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    return { ok: false, error: `Prazo para palpites de bônus encerrado em ${fmt}` };
  }

  await db.championBet.upsert({
    where: { userId_poolId: { userId, poolId } },
    update: { champTeamId, runnerUpTeamId, topScorerName },
    create: { userId, poolId, champTeamId, runnerUpTeamId, topScorerName },
  });

  return { ok: true, data: undefined };
}

export interface UserBetRow {
  matchId: string;
  kickoffAt: Date;
  homeName: string;
  homeCode: string;
  awayName: string;
  awayCode: string;
  homeScore: number | null;
  awayScore: number | null;
  homeGuess: number;
  awayGuess: number;
  pointsEarned: number | null;
  /** true quando a pontuação já foi consolidada (pointsEarned final). */
  scored: boolean;
}

export interface UserBetsInPool {
  bets: UserBetRow[];
  /** Conferência dos palpites-bônus (campeão/vice/artilheiro), null se o bolão não tem. */
  bonus: BonusResults | null;
}

/**
 * Retorna os palpites fechados de qualquer membro do bolão, junto com a
 * conferência dos palpites-bônus (campeão/vice/artilheiro).
 * Requer que o caller seja membro do mesmo bolão.
 */
export async function getUserBetsInPool(
  targetUserId: string,
  poolId: string,
): Promise<ActionResult<UserBetsInPool>> {
  if (!targetUserId || !poolId) return { ok: false, error: "Parâmetros inválidos" };
  const callerId = await requireUserId();
  await requireMembership(poolId, callerId);

  const [bets, bonus] = await Promise.all([
    db.bet.findMany({
      where: {
        userId: targetUserId,
        poolId,
        match: { status: "FINISHED" },
      },
      orderBy: { match: { kickoffAt: "desc" } },
      select: {
        homeGuess: true,
        awayGuess: true,
        pointsEarned: true,
        match: {
          select: {
            id: true,
            kickoffAt: true,
            homeScore: true,
            awayScore: true,
            scored: true,
            homeTeam: { select: { name: true, countryCode: true } },
            awayTeam: { select: { name: true, countryCode: true } },
          },
        },
      },
    }),
    getBonusResults({ userId: targetUserId, poolId }),
  ]);

  return {
    ok: true,
    data: {
      bets: bets.map((b) => ({
        matchId: b.match.id,
        kickoffAt: b.match.kickoffAt,
        homeName: b.match.homeTeam.name,
        homeCode: b.match.homeTeam.countryCode,
        awayName: b.match.awayTeam.name,
        awayCode: b.match.awayTeam.countryCode,
        homeScore: b.match.homeScore,
        awayScore: b.match.awayScore,
        homeGuess: b.homeGuess,
        awayGuess: b.awayGuess,
        pointsEarned: b.pointsEarned,
        scored: b.match.scored,
      })),
      bonus,
    },
  };
}
