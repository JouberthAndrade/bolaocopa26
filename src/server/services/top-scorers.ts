import { db } from "@/lib/db";
import { env } from "@/lib/env";

// Artilharia da Copa via API football-data.org (autenticada, estruturada).
// Endpoint: GET /v4/competitions/{id}/scorers?limit=20
const TOP_N = 20;
const FD_BASE = "https://api.football-data.org/v4";

export interface SyncScorersResult {
  count: number;
  syncedAt: string;
}

interface FDPlayer {
  id: number;
  name: string;
  nationality?: string;
}
interface FDTeam {
  id: number;
  name: string;
  crest?: string;
}
interface FDScorer {
  player: FDPlayer;
  team: FDTeam;
  playedMatches: number;
  goals: number;
  assists: number | null;
  penalties?: number;
}
interface FDScorersResponse {
  scorers: FDScorer[];
}

/**
 * Busca os top marcadores via football-data.org e sincroniza a tabela
 * `TopScorer` por UPSERT. Em caso de erro lança: o chamador (rota) devolve 500
 * e os dados existentes ficam intactos.
 */
export async function syncTopScorers(): Promise<SyncScorersResult> {
  const competitionId = env.FOOTBALL_DATA_COMPETITION_ID;

  const res = await fetch(
    `${FD_BASE}/competitions/${competitionId}/scorers?limit=${TOP_N}`,
    {
      headers: { "X-Auth-Token": env.FOOTBALL_DATA_TOKEN },
      cache: "no-store",
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Football-Data scorers ${res.status} ${res.statusText} ${body}`.trim(),
    );
  }

  const data = (await res.json()) as FDScorersResponse;
  const scorers = data.scorers ?? [];

  if (scorers.length === 0) {
    throw new Error("Football-Data: nenhum artilheiro encontrado");
  }

  const rows = scorers.slice(0, TOP_N).map((s, index) => ({
    externalId: `fd:${s.player.id}`,
    playerName: s.player.name,
    playerPhoto: "",
    nationality: s.player.nationality ?? "",
    teamName: s.team.name,
    teamLogo: s.team.crest ?? "",
    goals: s.goals,
    assists: s.assists ?? 0,
    appearances: s.playedMatches,
    position: index + 1,
  }));

  const currentIds = rows.map((r) => r.externalId);
  await db.$transaction([
    ...rows.map((row) => {
      const { externalId, ...rest } = row;
      return db.topScorer.upsert({
        where: { externalId },
        update: rest,
        create: row,
      });
    }),
    db.topScorer.deleteMany({ where: { externalId: { notIn: currentIds } } }),
  ]);

  return { count: rows.length, syncedAt: new Date().toISOString() };
}

export interface TopScorerRow {
  id: number;
  playerName: string;
  playerPhoto: string;
  teamName: string;
  teamLogo: string;
  nationality: string;
  goals: number;
  assists: number;
  appearances: number;
  position: number;
}

export interface TopScorersPayload {
  data: TopScorerRow[];
  lastSync: string | null;
}

/** Leitura direta do banco, ordenada por posição. Sem cache. */
export async function getTopScorers(): Promise<TopScorersPayload> {
  const rows = await db.topScorer.findMany({
    orderBy: { position: "asc" },
  });

  return {
    data: rows.map((r) => ({
      id: r.id,
      playerName: r.playerName,
      playerPhoto: r.playerPhoto,
      teamName: r.teamName,
      teamLogo: r.teamLogo,
      nationality: r.nationality,
      goals: r.goals,
      assists: r.assists,
      appearances: r.appearances,
      position: r.position,
    })),
    lastSync: rows[0]?.updatedAt.toISOString() ?? null,
  };
}
