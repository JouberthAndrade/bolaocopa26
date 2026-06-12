import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { countryNamePtBR } from "@/lib/country-codes";
import { getFootballProvider } from "@/server/providers/football/football-data";

const LOCK_MINUTES_BEFORE = 20;
const TOURNAMENT_NAME = "Copa do Mundo FIFA 2026";

/** Garante que o torneio exista e retorna seu id. */
export async function ensureTournament(): Promise<string> {
  const externalId = env.FOOTBALL_DATA_COMPETITION_ID;
  const tournament = await db.tournament.upsert({
    where: { externalId },
    update: {},
    create: {
      name: TOURNAMENT_NAME,
      externalId,
      season: "2026",
    },
  });
  return tournament.id;
}

/**
 * Importa/atualiza seleções e jogos a partir do provedor.
 * Idempotente: pode rodar quantas vezes quiser.
 */
export async function syncFromProvider() {
  const provider = getFootballProvider();
  const tournamentId = await ensureTournament();

  // 1) Times
  const providerTeams = await provider.fetchTeams();
  for (const t of providerTeams) {
    // Resolve nome em PT-BR a partir do código ISO-2; fallback para o nome da API
    const namePtBR = countryNamePtBR(t.countryCode) ?? t.name;
    await db.team.upsert({
      where: { tournamentId_externalId: { tournamentId, externalId: t.externalId } },
      update: {
        name: namePtBR,
        countryCode: t.countryCode,
        crestUrl: t.crestUrl ?? undefined,
      },
      create: {
        tournamentId,
        externalId: t.externalId,
        name: namePtBR,
        countryCode: t.countryCode,
        crestUrl: t.crestUrl ?? undefined,
        group: t.group ?? undefined,
      },
    });
  }

  // Mapa externalId -> id interno para resolver os jogos.
  const teams = await db.team.findMany({
    where: { tournamentId },
    select: { id: true, externalId: true },
  });
  const teamIdByExternal = new Map(teams.map((t) => [t.externalId, t.id]));

  // 2) Jogos
  const providerMatches = await provider.fetchMatches();
  let upserted = 0;
  let newlyFinished = 0;

  // Mapa para derivar o grupo de cada equipe a partir dos jogos de grupos
  const teamGroupMap = new Map<string, string>();
  for (const m of providerMatches) {
    if (m.stage === "GROUP" && m.group) {
      teamGroupMap.set(m.homeTeamExternalId, m.group);
      teamGroupMap.set(m.awayTeamExternalId, m.group);
    }
  }
  // Atualiza o group nas equipes
  for (const [extId, group] of teamGroupMap.entries()) {
    const teamId = teamIdByExternal.get(extId);
    if (teamId) {
      await db.team.update({ where: { id: teamId }, data: { group } });
    }
  }

  for (const m of providerMatches) {
    const homeTeamId = teamIdByExternal.get(m.homeTeamExternalId);
    const awayTeamId = teamIdByExternal.get(m.awayTeamExternalId);
    if (!homeTeamId || !awayTeamId) continue; // ainda sem confronto definido

    const lockAt = new Date(m.kickoffAt.getTime() - LOCK_MINUTES_BEFORE * 60_000);

    const existing = await db.match.findUnique({
      where: { externalId: m.externalId },
      select: { status: true },
    });

    await db.match.upsert({
      where: { externalId: m.externalId },
      update: {
        homeTeamId,
        awayTeamId,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        stage: m.stage,
        group: m.group ?? undefined,
        matchday: m.matchday ?? undefined,
        venue: m.venue ?? undefined,
        kickoffAt: m.kickoffAt,
        lockAt,
        status: m.status,
      },
      create: {
        externalId: m.externalId,
        tournamentId,
        homeTeamId,
        awayTeamId,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        stage: m.stage,
        group: m.group ?? undefined,
        matchday: m.matchday ?? undefined,
        venue: m.venue ?? undefined,
        kickoffAt: m.kickoffAt,
        lockAt,
        status: m.status,
      },
    });
    upserted++;
    if (existing?.status !== "FINISHED" && m.status === "FINISHED") newlyFinished++;
  }

  return { teams: providerTeams.length, matches: upserted, newlyFinished };
}
