import type { MatchStage, MatchStatus } from "@prisma/client";

export interface ProviderTeam {
  externalId: string;
  name: string;
  countryCode: string; // ISO-2 (ex.: "BR")
  crestUrl?: string | null;
  group?: string | null;
}

export interface ProviderMatch {
  externalId: string;
  homeTeamExternalId: string;
  awayTeamExternalId: string;
  homeScore: number | null;
  awayScore: number | null;
  stage: MatchStage;
  group?: string | null;
  venue?: string | null;
  kickoffAt: Date;
  status: MatchStatus;
}

/**
 * Contrato do provedor de dados de futebol.
 * Trocar de Football-Data para API-Football = implementar esta interface.
 */
export interface FootballProvider {
  fetchTeams(): Promise<ProviderTeam[]>;
  fetchMatches(): Promise<ProviderMatch[]>;
}
