import { db } from "@/lib/db";

export async function getPoolBySlug(slug: string) {
  return db.pool.findUnique({
    where: { slug },
    include: {
      scoringRule: true,
      prizeTiers: { orderBy: { position: "asc" } },
      invites: { take: 1, orderBy: { createdAt: "asc" } },
      // bots (Claudinho/Gepeto) não contam como participantes pagantes
      _count: { select: { memberships: { where: { user: { isBot: false } } } } },
    },
  });
}

/** Palpites de todos os membros para um jogo (respeitando a visibilidade). */
export async function getMatchBets(poolId: string, matchId: string) {
  return db.bet.findMany({
    where: { poolId, matchId },
    orderBy: { pointsEarned: "desc" },
    include: { user: { select: { name: true, image: true } } },
  });
}
