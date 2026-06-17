// Núcleo do "de-para" entre o provedor de placar ao vivo (ESPN) e os jogos do
// banco — função PURA, sem rede nem banco, para ser testável. A ESPN devolve
// nomes de seleção em inglês ("France", "Senegal"); nós casamos por código
// ISO (Team.countryCode), igual ao resto do app. Aqui só decidimos QUAIS jogos
// atualizar e com qual placar — a escrita fica no serviço.

import { teamCode } from "@/lib/team-name";

/** Fixture de placar ao vivo, já extraído da resposta da ESPN. */
export interface LiveFixture {
  /** id do evento na ESPN (só para log/diagnóstico) */
  fixtureId: number;
  homeName: string;
  awayName: string;
  /** gols ao vivo (a API manda número; null vira 0) */
  homeGoals: number | null;
  awayGoals: number | null;
  /** data/hora do jogo na API — desempata pares que se enfrentam mais de uma vez */
  date: Date;
}

/** Jogo do banco reduzido ao necessário para o casamento. */
export interface DbMatchLite {
  id: string;
  homeCode: string;
  awayCode: string;
  kickoffAt: Date;
  status: "SCHEDULED" | "LIVE" | "FINISHED" | "POSTPONED";
  homeScore: number | null;
  awayScore: number | null;
}

export interface LiveScoreUpdate {
  matchId: string;
  homeScore: number;
  awayScore: number;
  /** true quando o jogo ainda estava SCHEDULED e deve passar a LIVE */
  promoteToLive: boolean;
}

export interface LiveScorePlan {
  updates: LiveScoreUpdate[];
  /** fixtures que não casaram com nenhum jogo (seleção desconhecida ou sem confronto) */
  unmatched: { fixtureId: number; home: string; away: string }[];
}

const key = (homeCode: string, awayCode: string) => `${homeCode}|${awayCode}`;

/**
 * Decide os updates de placar a partir das fixtures ao vivo e dos jogos do banco.
 *
 * Regras:
 * - casa por par de códigos ISO (mandante|visitante);
 * - nunca rebaixa um jogo já FINISHED (esses são ignorados na entrada);
 * - quando o mesmo par aparece em mais de um jogo (grupos + mata-mata), escolhe
 *   o de kickoff mais próximo da data da fixture;
 * - só emite update quando o placar muda ou quando o jogo precisa virar LIVE.
 */
export function planLiveScoreUpdates(
  fixtures: LiveFixture[],
  matches: DbMatchLite[],
): LiveScorePlan {
  // Índice por par de códigos → candidatos (ignora jogos já finalizados).
  const byPair = new Map<string, DbMatchLite[]>();
  for (const m of matches) {
    if (m.status === "FINISHED") continue;
    const k = key(m.homeCode, m.awayCode);
    const list = byPair.get(k);
    if (list) list.push(m);
    else byPair.set(k, [m]);
  }

  const updates: LiveScoreUpdate[] = [];
  const unmatched: LiveScorePlan["unmatched"] = [];

  for (const f of fixtures) {
    const homeCode = teamCode(f.homeName);
    const awayCode = teamCode(f.awayName);
    if (!homeCode || !awayCode) {
      unmatched.push({ fixtureId: f.fixtureId, home: f.homeName, away: f.awayName });
      continue;
    }

    const candidates = byPair.get(key(homeCode, awayCode));
    if (!candidates || candidates.length === 0) {
      unmatched.push({ fixtureId: f.fixtureId, home: f.homeName, away: f.awayName });
      continue;
    }

    // Desempata pelo kickoff mais próximo da data da fixture.
    const target = f.date.getTime();
    const match = candidates.reduce((best, c) =>
      Math.abs(c.kickoffAt.getTime() - target) < Math.abs(best.kickoffAt.getTime() - target)
        ? c
        : best,
    );

    const homeScore = f.homeGoals ?? 0;
    const awayScore = f.awayGoals ?? 0;
    const promoteToLive = match.status === "SCHEDULED";
    const scoreChanged = match.homeScore !== homeScore || match.awayScore !== awayScore;

    if (scoreChanged || promoteToLive) {
      updates.push({ matchId: match.id, homeScore, awayScore, promoteToLive });
    }
  }

  return { updates, unmatched };
}
