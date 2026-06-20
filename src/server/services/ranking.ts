import { db } from "@/lib/db";
import type { ResultScoringRule } from "@/lib/bet-result";
import {
  sumLivePoints,
  mergeLiveRanking,
  type LiveMatchBets,
  type RankingBase,
  type RankingRow,
} from "@/lib/live-ranking";

// Re-export para manter o import público estável (componentes importam daqui).
export type { RankingRow };

/** Regra padrão quando o bolão ainda não tem ScoringRule (defaults do schema). */
const DEFAULT_SCORING_RULE: ResultScoringRule = {
  pointsExactScore: 1,
  pointsCorrectResult: 2,
  pointsCorrectDraw: 2,
};

/**
 * Ranking do bolão. A pontuação consolidada vem de Membership.totalPoints
 * (denormalizado, atualizado pelo cron só em jogos FINISHED). Por cima, somamos
 * de forma TRANSIENTE os pontos provisórios dos jogos LIVE — sem nenhum UPDATE de
 * pontuação parcial no banco. O placar ao vivo já está em Match (cron de
 * live-score), então o overlay é só leitura + cálculo puro (ver lib/live-ranking).
 */
export async function getRanking(poolId: string): Promise<RankingRow[]> {
  const pool = await db.pool.findUnique({
    where: { id: poolId },
    select: { tournamentId: true },
  });
  if (!pool) return [];

  const [memberships, finishedBets, scoringRule, liveMatches] = await Promise.all([
    db.membership.findMany({
      where: { poolId },
      select: {
        userId: true,
        totalPoints: true,
        user: { select: { name: true, image: true } },
      },
    }),
    // contagens de acertos/erros/placar-exato em jogos já finalizados
    db.bet.findMany({
      where: { poolId, match: { status: "FINISHED", scored: true } },
      select: {
        userId: true,
        pointsEarned: true,
        homeGuess: true,
        awayGuess: true,
        match: { select: { homeScore: true, awayScore: true } },
      },
    }),
    db.scoringRule.findUnique({
      where: { poolId },
      select: {
        pointsExactScore: true,
        pointsCorrectResult: true,
        pointsCorrectDraw: true,
      },
    }),
    // jogos AO VIVO com placar já registrado + os palpites deste bolão
    db.match.findMany({
      where: {
        tournamentId: pool.tournamentId,
        status: "LIVE",
        homeScore: { not: null },
        awayScore: { not: null },
      },
      select: {
        homeScore: true,
        awayScore: true,
        bets: {
          where: { poolId },
          select: { userId: true, homeGuess: true, awayGuess: true },
        },
      },
    }),
  ]);

  const stats = new Map<string, { hits: number; misses: number; exactHits: number }>();
  for (const b of finishedBets) {
    const s = stats.get(b.userId) ?? { hits: 0, misses: 0, exactHits: 0 };
    if (b.pointsEarned > 0) s.hits++;
    else s.misses++;
    if (b.match.homeScore === b.homeGuess && b.match.awayScore === b.awayGuess) {
      s.exactHits++;
    }
    stats.set(b.userId, s);
  }

  const liveByUser = sumLivePoints(
    liveMatches.map<LiveMatchBets>((m) => ({
      home: m.homeScore ?? 0,
      away: m.awayScore ?? 0,
      bets: m.bets,
    })),
    scoringRule ?? DEFAULT_SCORING_RULE,
  );

  const base: RankingBase[] = memberships.map((m) => ({
    userId: m.userId,
    name: m.user.name,
    image: m.user.image,
    consolidatedPoints: m.totalPoints,
    exactHits: stats.get(m.userId)?.exactHits ?? 0,
    hits: stats.get(m.userId)?.hits ?? 0,
    misses: stats.get(m.userId)?.misses ?? 0,
  }));

  return mergeLiveRanking(base, liveByUser);
}
