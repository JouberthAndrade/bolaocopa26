import type { MatchStage, MatchStatus } from "@prisma/client";
import { env } from "@/lib/env";
import { fifaToFlagCdn } from "@/lib/country-codes";
import type { FootballProvider, ProviderMatch, ProviderTeam } from "./types";

const BASE_URL = "https://api.football-data.org/v4";

/** Mapeia o "stage" da Football-Data para o enum interno. */
function mapStage(stage: string): MatchStage {
  switch (stage) {
    case "GROUP_STAGE":
    case "LEAGUE_STAGE":
      return "GROUP";
    case "LAST_32":
      return "R32";
    case "LAST_16":
      return "R16";
    case "QUARTER_FINALS":
      return "QF";
    case "SEMI_FINALS":
      return "SF";
    case "THIRD_PLACE":
      return "THIRD_PLACE";
    case "FINAL":
      return "FINAL";
    default:
      return "GROUP";
  }
}

/** Mapeia o "status" da Football-Data para o enum interno. */
function mapStatus(status: string): MatchStatus {
  switch (status) {
    case "IN_PLAY":
    case "PAUSED":
      return "LIVE";
    case "FINISHED":
      return "FINISHED";
    case "POSTPONED":
    case "SUSPENDED":
    case "CANCELLED":
      return "POSTPONED";
    default:
      return "SCHEDULED"; // SCHEDULED, TIMED
  }
}

interface FDArea {
  code?: string;
  name?: string;
}
interface FDTeam {
  id: number;
  name: string;
  shortName?: string;
  tla?: string;
  crest?: string;
  area?: FDArea;
}
interface FDMatch {
  id: number;
  utcDate: string;
  status: string;
  stage: string;
  group: string | null;
  homeTeam: { id: number | null };
  awayTeam: { id: number | null };
  score: { fullTime: { home: number | null; away: number | null } };
  venue?: string | null;
}

async function fdFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "X-Auth-Token": env.FOOTBALL_DATA_TOKEN },
    // Fixtures mudam pouco; placares são revalidados pelo cron.
    next: { revalidate: 60 },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Football-Data ${path} -> ${res.status} ${res.statusText} ${body}`);
  }
  return res.json() as Promise<T>;
}

export class FootballDataProvider implements FootballProvider {
  private readonly competitionId: string;

  constructor(competitionId = env.FOOTBALL_DATA_COMPETITION_ID) {
    this.competitionId = competitionId;
  }

  async fetchTeams(): Promise<ProviderTeam[]> {
    const data = await fdFetch<{ teams: FDTeam[] }>(
      `/competitions/${this.competitionId}/teams`,
    );
    return (data.teams ?? []).map((t) => ({
      externalId: String(t.id),
      name: t.name,
      // Converte código FIFA (3 letras) → ISO-2 para flagcdn.com
      countryCode: fifaToFlagCdn(t.area?.code ?? ""),
      crestUrl: t.crest ?? null,
      group: null,
    }));
  }

  async fetchMatches(): Promise<ProviderMatch[]> {
    const data = await fdFetch<{ matches: FDMatch[] }>(
      `/competitions/${this.competitionId}/matches`,
    );
    return (data.matches ?? [])
      .filter((m) => m.homeTeam.id != null && m.awayTeam.id != null)
      .map((m) => ({
        externalId: String(m.id),
        homeTeamExternalId: String(m.homeTeam.id),
        awayTeamExternalId: String(m.awayTeam.id),
        homeScore: m.score.fullTime.home,
        awayScore: m.score.fullTime.away,
        stage: mapStage(m.stage),
        group: m.group,
        venue: m.venue ?? null,
        kickoffAt: new Date(m.utcDate),
        status: mapStatus(m.status),
      }));
  }
}

/** Factory — único ponto que decide qual provider usar. */
export function getFootballProvider(): FootballProvider {
  return new FootballDataProvider();
}
