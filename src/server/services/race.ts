import type { BotKind, MatchStage } from "@prisma/client";
import { db } from "@/lib/db";

export interface RaceParticipant {
  userId: string;
  name: string | null;
  image: string | null;
  isBot: boolean;
  botKind: BotKind | null;
}

export interface RaceMatch {
  matchId: string;
  matchday: number | null; // rodada da fase de grupos (1, 2, 3)
  stage: MatchStage;
  kickoffAt: string; // ISO — o agrupamento por dia é feito no cliente (fuso local)
  /** códigos ISO dos times — usados no rótulo do checkpoint "Jogo" (ex.: TUR × PAR) */
  homeCode: string;
  awayCode: string;
  /** pontos que cada participante fez NESTE jogo (userId -> pontos) */
  points: Record<string, number>;
}

export interface RaceData {
  /** prêmio total = aposta × nº de participantes pagantes (sem bots) */
  prizeTotal: number;
  currency: string;
  /** participantes pagantes (sem bots) — base do prêmio */
  playerCount: number;
  participants: RaceParticipant[];
  /** jogos já pontuados, em ordem cronológica */
  matches: RaceMatch[];
}

/**
 * Dados da "corrida do bolão": participantes + a contribuição de cada jogo já
 * pontuado para a pontuação. O acúmulo por rodada/dia e as posições da corrida
 * são calculados no cliente (assim o agrupamento por dia respeita o fuso local).
 */
export async function getRaceData(poolId: string): Promise<RaceData> {
  const pool = await db.pool.findUnique({
    where: { id: poolId },
    select: {
      stakeAmount: true,
      currency: true,
      tournamentId: true,
      _count: { select: { memberships: { where: { user: { isBot: false } } } } },
    },
  });
  if (!pool) {
    return { prizeTotal: 0, currency: "BRL", playerCount: 0, participants: [], matches: [] };
  }

  const [memberships, matches] = await Promise.all([
    db.membership.findMany({
      where: { poolId },
      select: {
        userId: true,
        user: { select: { name: true, image: true, isBot: true, botKind: true } },
      },
    }),
    db.match.findMany({
      where: { tournamentId: pool.tournamentId, status: "FINISHED", scored: true },
      orderBy: { kickoffAt: "asc" },
      select: {
        id: true,
        matchday: true,
        stage: true,
        kickoffAt: true,
        homeTeam: { select: { countryCode: true } },
        awayTeam: { select: { countryCode: true } },
        bets: { where: { poolId }, select: { userId: true, pointsEarned: true } },
      },
    }),
  ]);

  const playerCount = pool._count.memberships;
  const prizeTotal = Number(pool.stakeAmount) * playerCount;

  return {
    prizeTotal,
    currency: pool.currency,
    playerCount,
    participants: memberships.map((m) => ({
      userId: m.userId,
      name: m.user.name,
      image: m.user.image,
      isBot: m.user.isBot,
      botKind: m.user.botKind,
    })),
    matches: matches.map((m) => ({
      matchId: m.id,
      matchday: m.matchday,
      stage: m.stage,
      kickoffAt: m.kickoffAt.toISOString(),
      homeCode: m.homeTeam.countryCode,
      awayCode: m.awayTeam.countryCode,
      points: Object.fromEntries(m.bets.map((b) => [b.userId, b.pointsEarned])),
    })),
  };
}
