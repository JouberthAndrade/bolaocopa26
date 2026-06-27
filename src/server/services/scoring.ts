import type { ScoringRule } from "@prisma/client";
import { db } from "@/lib/db";

type Outcome = "HOME" | "AWAY" | "DRAW";

function outcome(home: number, away: number): Outcome {
  if (home > away) return "HOME";
  if (home < away) return "AWAY";
  return "DRAW";
}

/**
 * Pontuação de um palpite (função pura — fácil de testar).
 * - placar exato: pointsCorrectResult/Draw + pointsExactScore (bônus)
 * - acertou resultado (vitória): pointsCorrectResult
 * - acertou empate (sem placar exato): pointsCorrectDraw
 */
export function computeBetPoints(
  rule: Pick<
    ScoringRule,
    "pointsExactScore" | "pointsCorrectResult" | "pointsCorrectDraw"
  >,
  guess: { home: number; away: number },
  actual: { home: number; away: number },
): number {
  const exact = guess.home === actual.home && guess.away === actual.away;
  const sameOutcome = outcome(guess.home, guess.away) === outcome(actual.home, actual.away);

  if (!sameOutcome) return 0;

  const isDraw = actual.home === actual.away;
  const base = isDraw ? rule.pointsCorrectDraw : rule.pointsCorrectResult;
  return exact ? base + rule.pointsExactScore : base;
}

/**
 * Calcula a pontuação de todos os jogos finalizados ainda não pontuados.
 * Idempotente: marca match.scored = true ao final.
 */
export async function scoreFinishedMatches() {
  const matches = await db.match.findMany({
    // resultConfirmed: só pontua placar confirmado pelo double-check do sync
    // (visto igual em dois ticks) — evita pontuar placar provisório do VAR.
    // Resultados manuais (admin/set-result) entram já confirmados.
    where: {
      status: "FINISHED",
      scored: false,
      resultConfirmed: true,
      homeScore: { not: null },
      awayScore: { not: null },
    },
    select: { id: true, homeScore: true, awayScore: true },
  });

  let scoredMatches = 0;
  const affectedPools = new Set<string>();

  for (const match of matches) {
    const actual = { home: match.homeScore!, away: match.awayScore! };

    const bets = await db.bet.findMany({
      where: { matchId: match.id },
      include: { pool: { include: { scoringRule: true } } },
    });

    await db.$transaction(async (tx) => {
      for (const bet of bets) {
        const rule = bet.pool.scoringRule;
        if (!rule) continue;
        const points = computeBetPoints(
          rule,
          { home: bet.homeGuess, away: bet.awayGuess },
          actual,
        );
        if (points !== bet.pointsEarned) {
          await tx.bet.update({ where: { id: bet.id }, data: { pointsEarned: points } });
        }
        affectedPools.add(bet.poolId);
      }
      await tx.match.update({ where: { id: match.id }, data: { scored: true } });
    });

    scoredMatches++;
  }

  // Recalcula totalPoints das memberships dos bolões afetados.
  for (const poolId of affectedPools) {
    await recalcPoolStandings(poolId);
  }

  return { scoredMatches, affectedPools: affectedPools.size };
}

/**
 * Recalcula totalPoints (palpites + bônus) de todos os membros de um bolão
 * e gera evento de feed quando há novo líder.
 */
export async function recalcPoolStandings(poolId: string) {
  const memberships = await db.membership.findMany({
    where: { poolId },
    select: { id: true, userId: true, totalPoints: true },
  });

  // soma de palpites por usuário
  const betSums = await db.bet.groupBy({
    by: ["userId"],
    where: { poolId },
    _sum: { pointsEarned: true },
  });
  const betByUser = new Map(betSums.map((b) => [b.userId, b._sum.pointsEarned ?? 0]));

  // bônus campeão/vice/artilheiro
  const champBets = await db.championBet.findMany({
    where: { poolId },
    select: { userId: true, pointsEarned: true },
  });
  const champByUser = new Map(champBets.map((c) => [c.userId, c.pointsEarned]));

  const previousLeader = [...memberships].sort((a, b) => b.totalPoints - a.totalPoints)[0];

  const updated: { userId: string; total: number }[] = [];
  await db.$transaction(
    memberships.map((m) => {
      const total = (betByUser.get(m.userId) ?? 0) + (champByUser.get(m.userId) ?? 0);
      updated.push({ userId: m.userId, total });
      return db.membership.update({
        where: { id: m.id },
        data: { totalPoints: total },
      });
    }),
  );

  const newLeader = [...updated].sort((a, b) => b.total - a.total)[0];
  if (newLeader && previousLeader && newLeader.userId !== previousLeader.userId) {
    await db.feedEvent.create({
      data: {
        poolId,
        type: "NEW_LEADER",
        userId: newLeader.userId,
        payload: { points: newLeader.total },
      },
    });
  }
}
