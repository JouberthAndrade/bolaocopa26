import { db } from "@/lib/db";
import {
  planLiveScoreUpdates,
  type DbMatchLite,
  type LiveFixture,
} from "@/lib/live-score";

// Placar ao vivo via API pública da ESPN (sem chave / sem limite de quota).
// Trocamos a API-Sports por causa das restrições do plano free.
const ESPN_URL =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";

/** Forma mínima da resposta da ESPN que nos interessa. */
interface EspnScoreboard {
  events?: EspnEvent[];
}

interface EspnEvent {
  id: string;
  date: string;
  competitions: EspnCompetition[];
}

interface EspnCompetition {
  date: string;
  status: { type: { state: "pre" | "in" | "post" } };
  competitors: EspnCompetitor[];
}

interface EspnCompetitor {
  homeAway: "home" | "away";
  /** placar como string ("0", "3") — pode vir vazio no pré-jogo */
  score: string;
  team: { displayName: string };
}

export interface LiveScoreResult {
  /** jogos em andamento encontrados na ESPN */
  live: number;
  updated: number;
  promoted: number;
  unmatched: { fixtureId: number; home: string; away: string }[];
}

/** Placar string → número; vazio/inválido vira null (o planner trata como 0). */
function parseScore(s: string | undefined): number | null {
  if (s == null || s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Atualiza o placar (e o status LIVE) dos jogos em andamento a partir da API
 * pública da ESPN. Faz UMA requisição por chamada — a cadência fica a cargo do
 * cron externo.
 *
 * A ESPN devolve TODOS os jogos do dia (pré, em andamento e finalizados); aqui
 * só consideramos os que estão `state === "in"` (1º/2º tempo ou intervalo).
 *
 * Importante: NÃO marca jogos como FINISHED nem mexe em `scored`/pontos. O
 * encerramento e a pontuação continuam por conta do outro cron (sync + score).
 */
export async function updateLiveScores(): Promise<LiveScoreResult> {
  const res = await fetch(ESPN_URL, { cache: "no-store" });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ESPN ${res.status} ${res.statusText} ${body}`.trim());
  }

  const data = (await res.json()) as EspnScoreboard;

  // Só jogos EM ANDAMENTO. Pré-jogo (pre) e finalizados (post) ficam de fora —
  // finalizar/pontuar é responsabilidade do cron de sync+score.
  const fixtures: LiveFixture[] = [];
  for (const event of data.events ?? []) {
    const comp = event.competitions[0];
    if (!comp || comp.status.type.state !== "in") continue;

    const home = comp.competitors.find((c) => c.homeAway === "home");
    const away = comp.competitors.find((c) => c.homeAway === "away");
    if (!home || !away) continue;

    fixtures.push({
      fixtureId: Number(event.id),
      homeName: home.team.displayName,
      awayName: away.team.displayName,
      homeGoals: parseScore(home.score),
      awayGoals: parseScore(away.score),
      date: new Date(comp.date ?? event.date),
    });
  }

  // Nada ao vivo → nem toca no banco.
  if (fixtures.length === 0) {
    return { live: 0, updated: 0, promoted: 0, unmatched: [] };
  }

  const dbMatches = await db.match.findMany({
    where: { status: { not: "FINISHED" } },
    select: {
      id: true,
      kickoffAt: true,
      status: true,
      homeScore: true,
      awayScore: true,
      homeTeam: { select: { countryCode: true } },
      awayTeam: { select: { countryCode: true } },
    },
  });

  const matches: DbMatchLite[] = dbMatches.map((m) => ({
    id: m.id,
    homeCode: m.homeTeam.countryCode,
    awayCode: m.awayTeam.countryCode,
    kickoffAt: m.kickoffAt,
    status: m.status,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
  }));

  const { updates, unmatched } = planLiveScoreUpdates(fixtures, matches);

  let promoted = 0;
  for (const u of updates) {
    await db.match.update({
      where: { id: u.matchId },
      data: {
        homeScore: u.homeScore,
        awayScore: u.awayScore,
        ...(u.promoteToLive ? { status: "LIVE" } : {}),
      },
    });
    if (u.promoteToLive) promoted++;
  }

  if (unmatched.length > 0) {
    console.warn("[live-score] fixtures sem correspondência:", unmatched);
  }

  return {
    live: fixtures.length,
    updated: updates.length,
    promoted,
    unmatched,
  };
}
