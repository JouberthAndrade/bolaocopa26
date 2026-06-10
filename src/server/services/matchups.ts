import { db } from "@/lib/db";
import { buildMatchupRows, type MatchupRow } from "@/lib/matchup";

export interface ConfrontoMatch {
  id: string;
  stage: string;
  group: string | null;
  kickoffAt: Date;
  homeScore: number;
  awayScore: number;
  home: { name: string; countryCode: string };
  away: { name: string; countryCode: string };
  betsCount: number;
}

/**
 * Jogos já encerrados do torneio do bolão, mais recentes primeiro, com a
 * contagem de palpites feitos NESTE bolão. Leve — alimenta a lista da aba.
 */
export async function getFinishedMatchups(poolId: string): Promise<ConfrontoMatch[]> {
  const pool = await db.pool.findUnique({
    where: { id: poolId },
    select: { tournamentId: true },
  });
  if (!pool) return [];

  const matches = await db.match.findMany({
    where: {
      tournamentId: pool.tournamentId,
      status: "FINISHED",
      homeScore: { not: null },
      awayScore: { not: null },
    },
    orderBy: { kickoffAt: "desc" },
    select: {
      id: true,
      stage: true,
      group: true,
      kickoffAt: true,
      homeScore: true,
      awayScore: true,
      homeTeam: { select: { name: true, countryCode: true } },
      awayTeam: { select: { name: true, countryCode: true } },
      _count: { select: { bets: { where: { poolId } } } },
    },
  });

  return matches.map((m) => ({
    id: m.id,
    stage: m.stage,
    group: m.group,
    kickoffAt: m.kickoffAt,
    homeScore: m.homeScore!,
    awayScore: m.awayScore!,
    home: m.homeTeam,
    away: m.awayTeam,
    betsCount: m._count.bets,
  }));
}

export interface MatchupDetail {
  match: {
    id: string;
    homeScore: number;
    awayScore: number;
    home: { name: string; countryCode: string };
    away: { name: string; countryCode: string };
  };
  rows: MatchupRow[];
}

/**
 * Palpites de todos os participantes do bolão para um jogo. Só revela depois do
 * travamento (lockAt) — sempre verdadeiro para jogos finalizados, mas validamos
 * de qualquer forma para nunca vazar palpite de jogo ainda aberto.
 */
export async function getMatchupDetail(
  poolId: string,
  matchId: string,
): Promise<MatchupDetail | null> {
  const match = await db.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      lockAt: true,
      homeScore: true,
      awayScore: true,
      homeTeam: { select: { name: true, countryCode: true } },
      awayTeam: { select: { name: true, countryCode: true } },
    },
  });
  if (!match || match.homeScore == null || match.awayScore == null) return null;
  if (new Date() < match.lockAt) return null; // ainda não revela

  const [memberships, bets] = await Promise.all([
    db.membership.findMany({
      where: { poolId },
      select: {
        userId: true,
        user: { select: { name: true, image: true, isBot: true, botKind: true } },
      },
    }),
    db.bet.findMany({
      where: { poolId, matchId },
      select: { userId: true, homeGuess: true, awayGuess: true, pointsEarned: true },
    }),
  ]);

  const members = memberships.map((m) => ({
    userId: m.userId,
    name: m.user.name,
    image: m.user.image,
    isBot: m.user.isBot,
    botKind: m.user.botKind,
  }));

  const rows = buildMatchupRows(members, bets, {
    home: match.homeScore,
    away: match.awayScore,
  });

  return {
    match: {
      id: match.id,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      home: match.homeTeam,
      away: match.awayTeam,
    },
    rows,
  };
}
