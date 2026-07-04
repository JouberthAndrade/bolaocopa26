import { db } from "@/lib/db";
import { normalizeGroup, computeGroupStandings, type TeamStanding } from "@/lib/group";

export async function getGroups() {
  const teams = await db.team.findMany({
    where: { group: { not: null } },
    orderBy: [{ group: "asc" }, { name: "asc" }],
    select: { id: true, name: true, countryCode: true, group: true, crestUrl: true },
  });

  const groupMap = new Map<string, typeof teams>();
  for (const t of teams) {
    const g = normalizeGroup(t.group!);
    if (!groupMap.has(g)) groupMap.set(g, []);
    groupMap.get(g)!.push(t);
  }

  return [...groupMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([letter, teams]) => ({ letter, teams }));
}

/**
 * Grupos com seleções E os jogos da fase de grupos já com o palpite do usuário
 * (no bolão informado). Alimenta o popup de palpites por grupo.
 */
export async function getGroupsWithMatches(opts: { userId: string; poolId: string }) {
  const [teams, matches] = await Promise.all([
    db.team.findMany({
      where: { group: { not: null } },
      orderBy: [{ group: "asc" }, { name: "asc" }],
      select: { id: true, name: true, countryCode: true, group: true },
    }),
    db.match.findMany({
      where: { stage: "GROUP", group: { not: null } },
      orderBy: [{ group: "asc" }, { kickoffAt: "asc" }],
      include: {
        homeTeam: { select: { name: true, countryCode: true, crestUrl: true } },
        awayTeam: { select: { name: true, countryCode: true, crestUrl: true } },
        bets: {
          where: { userId: opts.userId, poolId: opts.poolId },
          select: { homeGuess: true, awayGuess: true, pointsEarned: true, advances: true },
        },
      },
    }),
  ]);

  const mapped = matches.map((m) => ({
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
    penaltyWinner: m.penaltyWinner,
    scored: m.scored,
    home: m.homeTeam,
    away: m.awayTeam,
    bet: m.bets[0] ?? null,
  }));

  const matchesByGroup = new Map<string, typeof mapped>();
  for (const m of mapped) {
    const g = normalizeGroup(m.group!);
    if (!matchesByGroup.has(g)) matchesByGroup.set(g, []);
    matchesByGroup.get(g)!.push(m);
  }

  const teamsByGroup = new Map<string, typeof teams>();
  for (const t of teams) {
    const g = normalizeGroup(t.group!);
    if (!teamsByGroup.has(g)) teamsByGroup.set(g, []);
    teamsByGroup.get(g)!.push(t);
  }

  return [...teamsByGroup.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([letter, groupTeams]) => {
      const groupMatches = matchesByGroup.get(letter) ?? [];
      // Build match inputs for standings computation (need teamId per match row)
      const teamIdByName = new Map(groupTeams.map((t) => [t.name, t.id]));
      const matchInputs = groupMatches.map((m) => ({
        homeTeamId: teamIdByName.get(m.home.name) ?? "",
        awayTeamId: teamIdByName.get(m.away.name) ?? "",
        homeScore: m.homeScore,
        awayScore: m.awayScore,
      }));
      const standings: TeamStanding[] = computeGroupStandings(groupTeams, matchInputs);
      return { letter, teams: groupTeams, standings, matches: groupMatches };
    });
}

export async function getGroupMatches(tournamentId?: string) {
  const matches = await db.match.findMany({
    where: { stage: "GROUP" },
    orderBy: [{ group: "asc" }, { kickoffAt: "asc" }],
    include: {
      homeTeam: { select: { name: true, countryCode: true } },
      awayTeam: { select: { name: true, countryCode: true } },
    },
  });
  return matches;
}
