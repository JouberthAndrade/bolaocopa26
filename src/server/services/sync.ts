import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { countryNamePtBR } from "@/lib/country-codes";
import { getFootballProvider } from "@/server/providers/football/football-data";
import {
  decidePenaltyWinnerWrite,
  decideResultWrite,
} from "@/server/services/result-confirmation";

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
      select: {
        status: true,
        homeScore: true,
        awayScore: true,
        resultConfirmed: true,
        scored: true,
        penaltyWinner: true,
      },
    });

    // Double-check de resultado: decide se o placar/status do provedor pode ser
    // escrito ou se o jogo já está confirmado (travado). Um placar FINISHED só é
    // confirmado após ser visto IGUAL em dois ticks consecutivos — isso evita
    // pontuar placar provisório (gol anulado pelo VAR depois do FINISHED) e
    // protege resultados manuais/já confirmados. Ver result-confirmation.ts.
    const decision = decideResultWrite(existing, {
      status: m.status,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
    });

    // Metadados seguros de atualizar em qualquer estado do jogo.
    const meta = {
      homeTeamId,
      awayTeamId,
      stage: m.stage,
      group: m.group ?? undefined,
      matchday: m.matchday ?? undefined,
      venue: m.venue ?? undefined,
      kickoffAt: m.kickoffAt,
      lockAt,
    };

    // Backfill do vencedor dos pênaltis: preenche penaltyWinner faltante (ex.:
    // apagado por correção manual) mesmo em jogo travado, re-armando o scoring
    // quando já pontuado — assim o bônus de mata-mata é aplicado retroativamente.
    const penaltyWrite = decidePenaltyWinnerWrite(existing, m.penaltyWinner);

    // Campos de resultado a escrever quando o jogo ainda NÃO está confirmado.
    // Confirmado (locked): no máximo o backfill de penaltyWinner acima.
    const result = decision.locked
      ? penaltyWrite
      : {
          homeScore: decision.homeScore,
          awayScore: decision.awayScore,
          status: decision.status,
          resultConfirmed: decision.resultConfirmed,
          penaltyWinner: m.penaltyWinner,
          ...(decision.scored !== undefined
            ? { scored: decision.scored }
            : penaltyWrite?.scored !== undefined
              ? { scored: penaltyWrite.scored }
              : {}),
        };

    await db.match.upsert({
      where: { externalId: m.externalId },
      update: result ? { ...meta, ...result } : meta,
      create: {
        externalId: m.externalId,
        tournamentId,
        ...meta,
        // Em create, decision nunca é locked (existing == null).
        ...(result ?? {}),
      },
    });
    upserted++;
    if (existing?.status !== "FINISHED" && m.status === "FINISHED") newlyFinished++;
  }

  return { teams: providerTeams.length, matches: upserted, newlyFinished };
}
