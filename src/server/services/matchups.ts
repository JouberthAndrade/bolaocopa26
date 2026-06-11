import type { MatchStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { matchRevealAt, REVEAL_BEFORE_KICKOFF_MS } from "@/lib/constants";
import { buildMatchupRows, type MatchupRow } from "@/lib/matchup";

export interface ConfrontoMatch {
  id: string;
  stage: string;
  group: string | null;
  status: MatchStatus;
  kickoffAt: Date;
  /** null enquanto o jogo não tiver placar (revelado antes de começar) */
  homeScore: number | null;
  awayScore: number | null;
  home: { name: string; countryCode: string };
  away: { name: string; countryCode: string };
  betsCount: number;
}

/**
 * Jogos do torneio com palpites já revelados neste bolão: encerrados, ao vivo
 * ou a até 10 minutos do início (nunca antes do travamento). Mais recentes
 * primeiro, com a contagem de palpites feitos NESTE bolão.
 */
export async function getRevealedMatchups(poolId: string): Promise<ConfrontoMatch[]> {
  const pool = await db.pool.findUnique({
    where: { id: poolId },
    select: { tournamentId: true },
  });
  if (!pool) return [];

  const now = new Date();
  const matches = await db.match.findMany({
    where: {
      tournamentId: pool.tournamentId,
      kickoffAt: { lte: new Date(now.getTime() + REVEAL_BEFORE_KICKOFF_MS) },
    },
    orderBy: { kickoffAt: "desc" },
    select: {
      id: true,
      stage: true,
      group: true,
      status: true,
      kickoffAt: true,
      lockAt: true,
      homeScore: true,
      awayScore: true,
      homeTeam: { select: { name: true, countryCode: true } },
      awayTeam: { select: { name: true, countryCode: true } },
      _count: { select: { bets: { where: { poolId } } } },
    },
  });

  return matches
    .filter((m) => now >= matchRevealAt(m.kickoffAt, m.lockAt))
    .map((m) => ({
      id: m.id,
      stage: m.stage,
      group: m.group,
      status: m.status,
      kickoffAt: m.kickoffAt,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      home: m.homeTeam,
      away: m.awayTeam,
      betsCount: m._count.bets,
    }));
}

export interface MatchupDetail {
  match: {
    id: string;
    status: MatchStatus;
    homeScore: number | null;
    awayScore: number | null;
    home: { name: string; countryCode: string };
    away: { name: string; countryCode: string };
  };
  rows: MatchupRow[];
}

/**
 * Palpites de todos os participantes do bolão para um jogo. Revela a partir de
 * 10 minutos antes do início (e nunca antes do lockAt) — assim ninguém vê
 * palpite que ainda pode ser editado.
 */
export async function getMatchupDetail(
  poolId: string,
  matchId: string,
): Promise<MatchupDetail | null> {
  const match = await db.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      status: true,
      kickoffAt: true,
      lockAt: true,
      homeScore: true,
      awayScore: true,
      homeTeam: { select: { name: true, countryCode: true } },
      awayTeam: { select: { name: true, countryCode: true } },
    },
  });
  if (!match) return null;
  if (new Date() < matchRevealAt(match.kickoffAt, match.lockAt)) return null; // ainda não revela

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

  const actual =
    match.homeScore != null && match.awayScore != null
      ? { home: match.homeScore, away: match.awayScore }
      : null;

  const rows = buildMatchupRows(members, bets, actual);

  return {
    match: {
      id: match.id,
      status: match.status,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      home: match.homeTeam,
      away: match.awayTeam,
    },
    rows,
  };
}
