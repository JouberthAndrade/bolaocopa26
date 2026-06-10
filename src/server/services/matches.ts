import { db } from "@/lib/db";

export async function getUserPools(userId: string) {
  return db.pool.findMany({
    where: { memberships: { some: { userId } } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      betsVisibility: true,
      // bots não contam como participantes
      _count: { select: { memberships: { where: { user: { isBot: false } } } } },
    },
  });
}

/**
 * Jogos de uma janela de tempo com o palpite do usuário (no bolão dado).
 * Inclui escudos/nomes das seleções.
 */
export async function getMatchesWithBets(opts: {
  userId: string;
  poolId: string;
  from: Date;
  to: Date;
}) {
  const matches = await db.match.findMany({
    where: { kickoffAt: { gte: opts.from, lte: opts.to } },
    orderBy: { kickoffAt: "asc" },
    include: {
      homeTeam: { select: { name: true, countryCode: true, crestUrl: true } },
      awayTeam: { select: { name: true, countryCode: true, crestUrl: true } },
      bets: {
        where: { userId: opts.userId, poolId: opts.poolId },
        select: { homeGuess: true, awayGuess: true, pointsEarned: true },
      },
    },
  });

  return matches.map((m) => ({
    id: m.id,
    kickoffAt: m.kickoffAt,
    lockAt: m.lockAt,
    status: m.status,
    stage: m.stage,
    group: m.group,
    venue: m.venue,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    home: m.homeTeam,
    away: m.awayTeam,
    bet: m.bets[0] ?? null,
  }));
}

export type MatchWithBet = Awaited<ReturnType<typeof getMatchesWithBets>>[number];

/**
 * true quando a fase de grupos terminou (todos os jogos GROUP finalizados).
 * Enquanto false, os palpites das fases finais permanecem fechados.
 */
export async function isGroupStageComplete(): Promise<boolean> {
  const [total, pending] = await Promise.all([
    db.match.count({ where: { stage: "GROUP" } }),
    db.match.count({ where: { stage: "GROUP", status: { not: "FINISHED" } } }),
  ]);
  return total > 0 && pending === 0;
}

/** Seleções do torneio (para o palpite de campeão/vice). */
export async function getTournamentTeams() {
  return db.team.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, countryCode: true },
  });
}

/**
 * Todos os jogos do torneio com o palpite do usuário (no bolão dado).
 * Usado pelo calendário, que precisa enxergar o campeonato inteiro.
 */
export async function getAllMatchesWithBets(opts: {
  userId: string;
  poolId: string;
}) {
  const matches = await db.match.findMany({
    orderBy: { kickoffAt: "asc" },
    include: {
      homeTeam: { select: { name: true, countryCode: true, crestUrl: true } },
      awayTeam: { select: { name: true, countryCode: true, crestUrl: true } },
      bets: {
        where: { userId: opts.userId, poolId: opts.poolId },
        select: { homeGuess: true, awayGuess: true, pointsEarned: true },
      },
    },
  });

  return matches.map((m) => ({
    id: m.id,
    kickoffAt: m.kickoffAt,
    lockAt: m.lockAt,
    status: m.status,
    stage: m.stage,
    group: m.group,
    venue: m.venue,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    home: m.homeTeam,
    away: m.awayTeam,
    bet: m.bets[0] ?? null,
  })) satisfies MatchWithBet[];
}

/** Próximos N jogos (quando não há jogos hoje). */
export async function getUpcomingMatchesWithBets(opts: {
  userId: string;
  poolId: string;
  take?: number;
}) {
  const matches = await db.match.findMany({
    where: { kickoffAt: { gte: new Date() } },
    orderBy: { kickoffAt: "asc" },
    take: opts.take ?? 8,
    include: {
      homeTeam: { select: { name: true, countryCode: true, crestUrl: true } },
      awayTeam: { select: { name: true, countryCode: true, crestUrl: true } },
      bets: {
        where: { userId: opts.userId, poolId: opts.poolId },
        select: { homeGuess: true, awayGuess: true, pointsEarned: true },
      },
    },
  });
  return matches.map((m) => ({
    id: m.id,
    kickoffAt: m.kickoffAt,
    lockAt: m.lockAt,
    status: m.status,
    stage: m.stage,
    group: m.group,
    venue: m.venue,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    home: m.homeTeam,
    away: m.awayTeam,
    bet: m.bets[0] ?? null,
  }));
}
