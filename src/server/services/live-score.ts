import { db } from "@/lib/db";
import { env } from "@/lib/env";
import {
  planLiveScoreUpdates,
  type DbMatchLite,
  type LiveFixture,
} from "@/lib/live-score";

const LIVE_URL = "https://v3.football.api-sports.io/fixtures";

/** Forma mínima da resposta da API-Sports que nos interessa. */
interface ApiSportsResponse {
  errors?: unknown;
  results?: number;
  response?: Array<{
    fixture: { id: number; date: string };
    teams: { home: { name: string }; away: { name: string } };
    goals: { home: number | null; away: number | null };
  }>;
}

/** Limites de uso lidos dos headers (o plano free é 10 req/min). */
export interface RateLimit {
  minuteLimit: string | null;
  minuteRemaining: string | null;
  dayLimit: string | null;
  dayRemaining: string | null;
}

function readRateLimit(h: Headers): RateLimit {
  return {
    minuteLimit: h.get("X-RateLimit-Limit"),
    minuteRemaining: h.get("X-RateLimit-Remaining"),
    dayLimit: h.get("x-ratelimit-requests-limit"),
    dayRemaining: h.get("x-ratelimit-requests-remaining"),
  };
}

export interface LiveScoreResult {
  live: number;
  updated: number;
  promoted: number;
  unmatched: { fixtureId: number; home: string; away: string }[];
  rateLimit: RateLimit;
  /** preenchido quando a API recusou a chamada (ex.: quota diária esgotada) */
  note?: string;
}

/**
 * Atualiza o placar (e o status LIVE) dos jogos em andamento a partir da
 * API-Sports. Faz UMA requisição por chamada — a cadência fica a cargo do
 * cron externo (respeitando o limite de 10 req/min do plano free).
 *
 * Importante: NÃO marca jogos como FINISHED nem mexe em `scored`/pontos. O
 * encerramento e a pontuação continuam por conta do outro cron (sync + score).
 */
export async function updateLiveScores(): Promise<LiveScoreResult> {
  const apiKey = env.API_SPORTS_KEY;
  if (!apiKey) throw new Error("API_SPORTS_KEY não configurada");

  const url = `${LIVE_URL}?live=all&league=${env.API_SPORTS_LEAGUE_ID}`;
  const res = await fetch(url, {
    headers: { "x-apisports-key": apiKey },
    cache: "no-store",
  });
  const rateLimit = readRateLimit(res.headers);

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API-Sports ${res.status} ${res.statusText} ${body}`.trim());
  }

  const data = (await res.json()) as ApiSportsResponse;
  const errs = data.errors;
  const hasErrors = Array.isArray(errs)
    ? errs.length > 0
    : !!errs && Object.keys(errs).length > 0;
  if (hasErrors) {
    const text = JSON.stringify(errs).toLowerCase();
    // Quota/limite é transitório e esperado no plano free — não é falha do
    // servidor. Retorna 200 com nota (cron não marca como erro); o detalhe
    // fica visível na resposta. Erros reais (chave inválida etc.) sobem como 500.
    if (text.includes("limit") || text.includes("rate") || text.includes("quota")) {
      return {
        live: 0,
        updated: 0,
        promoted: 0,
        unmatched: [],
        rateLimit,
        note: `api-limit: ${JSON.stringify(errs)}`,
      };
    }
    throw new Error(`API-Sports retornou erros: ${JSON.stringify(errs)}`);
  }

  const fixtures: LiveFixture[] = (data.response ?? []).map((r) => ({
    fixtureId: r.fixture.id,
    homeName: r.teams.home.name,
    awayName: r.teams.away.name,
    homeGoals: r.goals.home,
    awayGoals: r.goals.away,
    date: new Date(r.fixture.date),
  }));

  // Nada ao vivo → nem toca no banco.
  if (fixtures.length === 0) {
    return { live: 0, updated: 0, promoted: 0, unmatched: [], rateLimit };
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
    rateLimit,
  };
}
