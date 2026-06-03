import { db } from "@/lib/db";

export interface RankingRow {
  position: number;
  userId: string;
  name: string | null;
  image: string | null;
  totalPoints: number;
  exactHits: number; // palpites com placar exato (pontuou o bônus)
  hits: number; // palpites que pontuaram
  misses: number; // palpites que zeraram (jogo já finalizado)
}

/**
 * Ranking do bolão. Lê de Membership.totalPoints (denormalizado) e
 * complementa com contagens de acertos/erros por palpite finalizado.
 */
export async function getRanking(poolId: string): Promise<RankingRow[]> {
  const memberships = await db.membership.findMany({
    where: { poolId },
    orderBy: { totalPoints: "desc" },
    select: {
      userId: true,
      totalPoints: true,
      user: { select: { name: true, image: true } },
    },
  });

  // contagens de acertos/erros/placar-exato em jogos já finalizados
  const bets = await db.bet.findMany({
    where: { poolId, match: { status: "FINISHED", scored: true } },
    select: {
      userId: true,
      pointsEarned: true,
      homeGuess: true,
      awayGuess: true,
      match: { select: { homeScore: true, awayScore: true } },
    },
  });

  const stats = new Map<string, { hits: number; misses: number; exactHits: number }>();
  for (const b of bets) {
    const s = stats.get(b.userId) ?? { hits: 0, misses: 0, exactHits: 0 };
    if (b.pointsEarned > 0) s.hits++;
    else s.misses++;
    if (b.match.homeScore === b.homeGuess && b.match.awayScore === b.awayGuess) {
      s.exactHits++;
    }
    stats.set(b.userId, s);
  }

  return memberships.map((m, i) => ({
    position: i + 1,
    userId: m.userId,
    name: m.user.name,
    image: m.user.image,
    totalPoints: m.totalPoints,
    exactHits: stats.get(m.userId)?.exactHits ?? 0,
    hits: stats.get(m.userId)?.hits ?? 0,
    misses: stats.get(m.userId)?.misses ?? 0,
  }));
}
