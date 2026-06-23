import { db } from "@/lib/db";
import { KNOCKOUT_UNLOCK_DATE } from "@/lib/constants";
import { computeGroupStandings } from "@/lib/group";
import { BRACKET_BY_STAGE, resolveSlot } from "@/lib/bracket";
import type { MatchStage, MatchStatus } from "@prisma/client";

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
    matchday: m.matchday,
    venue: m.venue,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    home: m.homeTeam,
    away: m.awayTeam,
    bet: m.bets[0] ?? null,
  }));
}

export interface MatchWithBet {
  id: string;
  kickoffAt: Date;
  lockAt: Date;
  status: MatchStatus;
  stage: MatchStage;
  group: string | null;
  matchday: number | null;
  venue: string | null;
  homeScore: number | null;
  awayScore: number | null;
  home: { name: string; countryCode: string; crestUrl: string | null };
  away: { name: string; countryCode: string; crestUrl: string | null };
  bet: { homeGuess: number; awayGuess: number; pointsEarned: number } | null;
  // Virtual match fields (in-memory only, never persisted):
  isVirtual?: true;
  homeLabel?: string;
  awayLabel?: string;
  slotLabel?: string;
}

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

/**
 * Libera palpites do mata-mata quando ocorrer o PRIMEIRO de:
 * - Todos os jogos GROUP finalizados
 * - Data/hora 27/06/2026 às 23h BRT (02:00 UTC do dia 28)
 */
export async function isKnockoutUnlocked(): Promise<boolean> {
  if (new Date() >= KNOCKOUT_UNLOCK_DATE) return true;
  return isGroupStageComplete();
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
    matchday: m.matchday,
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
    matchday: m.matchday,
    venue: m.venue,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    home: m.homeTeam,
    away: m.awayTeam,
    bet: m.bets[0] ?? null,
  }));
}

const KNOCKOUT_STAGES: MatchStage[] = ["R32", "R16", "QF", "SF", "THIRD_PLACE", "FINAL"];

/**
 * Todos os jogos do torneio (fases de grupo + eliminatórias).
 * Para fases sem partidas no BD, gera confrontos virtuais em memória:
 *   R32 → times resolvidos a partir dos standings atuais (bandeira quando possível)
 *   R16+ → labels de slot ("Venc. R32-1 vs Venc. R32-2")
 * Partidas virtuais têm isVirtual=true e lockAt=KNOCKOUT_UNLOCK_DATE.
 */
export async function getKnockoutMatchesWithVirtual(opts: {
  userId: string;
  poolId: string;
}): Promise<MatchWithBet[]> {
  const real = await getAllMatchesWithBets(opts);

  // Determine which knockout stages already have real matches in DB
  const stagesWithData = new Set(real.map((m) => m.stage));

  // Compute group standings from DB matches for R32 resolution
  const groupMatches = real.filter((m) => m.stage === "GROUP");
  const standingsMap = buildStandingsMap(groupMatches, real);

  const virtual: MatchWithBet[] = [];

  for (const stage of KNOCKOUT_STAGES) {
    if (stagesWithData.has(stage)) continue; // real data exists — skip virtual generation

    const bracketMatches = BRACKET_BY_STAGE[stage];
    if (!bracketMatches) continue;

    bracketMatches.forEach((bm, idx) => {
      const homeResolved = resolveSlot(bm.home, standingsMap);
      const awayResolved = resolveSlot(bm.away, standingsMap);

      virtual.push({
        id: `virtual-${stage}-${idx}`,
        kickoffAt: new Date(KNOCKOUT_UNLOCK_DATE.getTime() + idx * 60_000),
        lockAt: KNOCKOUT_UNLOCK_DATE,
        status: "SCHEDULED",
        stage,
        group: null,
        matchday: idx + 1,
        venue: null,
        homeScore: null,
        awayScore: null,
        home: {
          name: homeResolved.team?.name ?? homeResolved.label,
          countryCode: homeResolved.team?.countryCode ?? "",
          crestUrl: null,
        },
        away: {
          name: awayResolved.team?.name ?? awayResolved.label,
          countryCode: awayResolved.team?.countryCode ?? "",
          crestUrl: null,
        },
        bet: null,
        isVirtual: true,
        homeLabel: homeResolved.label,
        awayLabel: awayResolved.label,
        slotLabel: bm.slotLabel,
      });
    });
  }

  return [...real, ...virtual];
}

/**
 * Constrói o Map de standings por grupo a partir dos matches GROUP.
 * Necessita das teams dentro dos matches para montar os standings.
 */
function buildStandingsMap(
  groupMatches: MatchWithBet[],
  allMatches: MatchWithBet[],
): Map<string, ReturnType<typeof computeGroupStandings>> {
  // Collect unique teams per group from match participants
  const teamsByGroup = new Map<string, Array<{ id: string; name: string; countryCode: string }>>();
  const teamIdSet = new Map<string, { id: string; name: string; countryCode: string }>();

  for (const m of groupMatches) {
    const g = m.group ?? "";
    if (!teamsByGroup.has(g)) teamsByGroup.set(g, []);
    const group = teamsByGroup.get(g)!;
    // home
    if (!teamIdSet.has(`${g}-${m.home.name}`)) {
      const t = { id: `${g}-home-${m.home.name}`, name: m.home.name, countryCode: m.home.countryCode };
      teamIdSet.set(`${g}-${m.home.name}`, t);
      group.push(t);
    }
    // away
    if (!teamIdSet.has(`${g}-${m.away.name}`)) {
      const t = { id: `${g}-away-${m.away.name}`, name: m.away.name, countryCode: m.away.countryCode };
      teamIdSet.set(`${g}-${m.away.name}`, t);
      group.push(t);
    }
  }

  const standingsMap = new Map<string, ReturnType<typeof computeGroupStandings>>();

  for (const [group, teams] of teamsByGroup) {
    const matches = groupMatches
      .filter((m) => m.group === group)
      .map((m) => ({
        homeTeamId: teamIdSet.get(`${group}-${m.home.name}`)?.id ?? "",
        awayTeamId: teamIdSet.get(`${group}-${m.away.name}`)?.id ?? "",
        homeScore: m.homeScore,
        awayScore: m.awayScore,
      }));
    standingsMap.set(group, computeGroupStandings(teams, matches));
  }

  return standingsMap;
}
