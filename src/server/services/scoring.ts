import type { Advance, ScoringRule } from "@prisma/client";
import { db } from "@/lib/db";
import { POINTS_PENALTY_ADVANCE } from "@/lib/constants";

type Outcome = "HOME" | "AWAY" | "DRAW";

function outcome(home: number, away: number): Outcome {
  if (home > away) return "HOME";
  if (home < away) return "AWAY";
  return "DRAW";
}

/**
 * Pontuação de um palpite (função pura — fácil de testar).
 * - placar exato: pointsCorrectResult/Draw + pointsExactScore (bônus aditivo)
 * - acertou resultado (vitória): pointsCorrectResult
 * - acertou empate (sem placar exato): pointsCorrectDraw
 * - bônus de mata-mata: SOMADO POR CIMA — jogo decidido nos pênaltis (penaltyWinner != null),
 *   palpite foi empate e acertou quem avançou. Independente do bônus de placar exato.
 */
export function computeBetPoints(
  rule: Pick<
    ScoringRule,
    "pointsExactScore" | "pointsCorrectResult" | "pointsCorrectDraw"
  >,
  guess: { home: number; away: number },
  actual: { home: number; away: number },
  penalty?: {
    betAdvances?: Advance | null;
    penaltyWinner?: Advance | null;
    bonus?: number;
  },
): number {
  const exact = guess.home === actual.home && guess.away === actual.away;
  const sameOutcome = outcome(guess.home, guess.away) === outcome(actual.home, actual.away);

  if (!sameOutcome) return 0;

  const isDraw = actual.home === actual.away;
  const base = isDraw ? rule.pointsCorrectDraw : rule.pointsCorrectResult;
  let points = exact ? base + rule.pointsExactScore : base;

  // Bônus de mata-mata: jogo decidido nos pênaltis (penaltyWinner != null),
  // palpite foi empate e o usuário acertou quem avançou. Somado por cima.
  if (
    penalty?.penaltyWinner != null &&
    guess.home === guess.away &&
    penalty.betAdvances != null &&
    penalty.betAdvances === penalty.penaltyWinner
  ) {
    points += penalty.bonus ?? 0;
  }

  return points;
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
    select: { id: true, homeScore: true, awayScore: true, penaltyWinner: true },
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
          {
            betAdvances: bet.advances,
            penaltyWinner: match.penaltyWinner,
            bonus: POINTS_PENALTY_ADVANCE,
          },
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

  // Assim que a Final estiver finalizada, julga os bônus de campeão/vice/artilheiro
  // e já reflete no ranking (recalcPoolStandings próprio, idempotente).
  const bonus = await scoreChampionBonuses();

  return {
    scoredMatches,
    affectedPools: affectedPools.size,
    bonus,
  };
}

export function normalizePlayerName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export interface TournamentBonusWinners {
  championTeamId: string;
  runnerUpTeamId: string;
  topScorerName: string | null;
}

export interface FinalMatchResult {
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  penaltyWinner: Advance | null;
}

/**
 * Decide campeão/vice a partir do placar da Final — ou, em caso de empate, do
 * vencedor do shootout (penaltyWinner). Retorna null enquanto o empate ainda
 * não tiver pênaltis registrados (jogo aguardando o próximo tick do sync).
 * Função pura — fácil de testar (ver computeBetPoints acima).
 */
export function resolveFinalWinner(
  final: FinalMatchResult,
): { championTeamId: string; runnerUpTeamId: string } | null {
  if (final.homeScore > final.awayScore) {
    return { championTeamId: final.homeTeamId, runnerUpTeamId: final.awayTeamId };
  }
  if (final.awayScore > final.homeScore) {
    return { championTeamId: final.awayTeamId, runnerUpTeamId: final.homeTeamId };
  }
  if (final.penaltyWinner === "HOME") {
    return { championTeamId: final.homeTeamId, runnerUpTeamId: final.awayTeamId };
  }
  if (final.penaltyWinner === "AWAY") {
    return { championTeamId: final.awayTeamId, runnerUpTeamId: final.homeTeamId };
  }
  return null;
}

/**
 * Descobre campeão/vice a partir do jogo da Final já finalizado e o
 * artilheiro real (posição 1 da tabela TopScorer, sincronizada via
 * football-data.org). Retorna null enquanto a Final não estiver decidida
 * (inclusive empate sem pênaltis registrados ainda).
 */
export async function resolveTournamentBonusWinners(
  tournamentId: string,
): Promise<TournamentBonusWinners | null> {
  const final = await db.match.findFirst({
    where: {
      tournamentId,
      stage: "FINAL",
      status: "FINISHED",
      resultConfirmed: true,
      homeScore: { not: null },
      awayScore: { not: null },
    },
    select: {
      homeTeamId: true,
      awayTeamId: true,
      homeScore: true,
      awayScore: true,
      penaltyWinner: true,
    },
  });
  if (!final) return null;

  const winner = resolveFinalWinner({
    homeTeamId: final.homeTeamId,
    awayTeamId: final.awayTeamId,
    homeScore: final.homeScore!,
    awayScore: final.awayScore!,
    penaltyWinner: final.penaltyWinner,
  });
  if (!winner) return null;
  const { championTeamId, runnerUpTeamId } = winner;

  const topScorer = await db.topScorer.findFirst({
    where: { position: 1 },
    select: { playerName: true },
  });

  return { championTeamId, runnerUpTeamId, topScorerName: topScorer?.playerName ?? null };
}

/**
 * Julga os palpites-bônus (campeão/vice/artilheiro) de todos os bolões cujo
 * torneio já teve a Final decidida. Idempotente: só grava quando os pontos
 * calculados mudam, e recalcula o totalPoints dos bolões afetados.
 */
export async function scoreChampionBonuses() {
  const tournaments = await db.tournament.findMany({
    where: { matches: { some: { stage: "FINAL", status: "FINISHED", resultConfirmed: true } } },
    select: { id: true },
  });

  let updatedBets = 0;
  const affectedPools = new Set<string>();

  for (const t of tournaments) {
    const winners = await resolveTournamentBonusWinners(t.id);
    if (!winners) continue;

    const pools = await db.pool.findMany({
      where: { tournamentId: t.id },
      select: {
        id: true,
        scoringRule: {
          select: { championBonus: true, runnerUpBonus: true, topScorerBonus: true },
        },
        championBets: {
          select: {
            id: true,
            champTeamId: true,
            runnerUpTeamId: true,
            topScorerName: true,
            pointsEarned: true,
          },
        },
      },
    });

    for (const pool of pools) {
      const rule = pool.scoringRule;
      if (!rule) continue;

      for (const bet of pool.championBets) {
        let points = 0;
        if (bet.champTeamId && bet.champTeamId === winners.championTeamId) {
          points += rule.championBonus;
        }
        if (bet.runnerUpTeamId && bet.runnerUpTeamId === winners.runnerUpTeamId) {
          points += rule.runnerUpBonus;
        }
        if (
          winners.topScorerName &&
          bet.topScorerName &&
          normalizePlayerName(bet.topScorerName) === normalizePlayerName(winners.topScorerName)
        ) {
          points += rule.topScorerBonus;
        }

        if (points !== bet.pointsEarned) {
          await db.championBet.update({ where: { id: bet.id }, data: { pointsEarned: points } });
          updatedBets++;
        }
      }
      affectedPools.add(pool.id);
    }
  }

  for (const poolId of affectedPools) {
    await recalcPoolStandings(poolId);
  }

  return { updatedBets, affectedPools: affectedPools.size };
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
