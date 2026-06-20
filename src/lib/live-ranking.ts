// Overlay de pontuação AO VIVO do ranking — funções PURAS, sem banco, para serem
// testáveis e reaproveitáveis. A ideia: o banco continua sendo a fonte da verdade
// só para jogos FINISHED (Membership.totalPoints). Aqui somamos, de forma
// transiente, os pontos provisórios dos jogos LIVE (cujo placar o cron da ESPN já
// escreve em Match) e mesclamos com o consolidado para reordenar o ranking — sem
// nenhum UPDATE de pontuação parcial no banco.

import { classifyBet, pointsForResult, type ResultScoringRule } from "./bet-result";

/** Um jogo ao vivo com seu placar atual e os palpites do bolão para ele. */
export interface LiveMatchBets {
  /** placar ao vivo do mandante (já persistido em Match pelo cron de live-score) */
  home: number;
  /** placar ao vivo do visitante */
  away: number;
  bets: { userId: string; homeGuess: number; awayGuess: number }[];
}

/** Linha-base do ranking: o que vem do consolidado (banco). */
export interface RankingBase {
  userId: string;
  name: string | null;
  image: string | null;
  /** Membership.totalPoints — pontuação oficial dos jogos FINISHED */
  consolidatedPoints: number;
  exactHits: number;
  hits: number;
  misses: number;
}

/** Linha do ranking já com o overlay ao vivo aplicado. */
export interface RankingRow extends RankingBase {
  position: number;
  /** pontos provisórios somados dos jogos LIVE (0 se nada ao vivo para o usuário) */
  livePoints: number;
  /** consolidatedPoints + livePoints — base da ordenação exibida */
  totalPoints: number;
  /** true quando o usuário tem pontos provisórios em jogo ao vivo */
  isLive: boolean;
}

/**
 * Soma os pontos provisórios por participante a partir dos jogos ao vivo.
 * Trata o placar ao vivo como "final provisório" (finished: true) para reusar a
 * mesma classificação/pontuação do Confronto. Só pontos > 0 entram no mapa.
 */
export function sumLivePoints(
  liveMatches: LiveMatchBets[],
  rule: ResultScoringRule,
): Map<string, number> {
  const acc = new Map<string, number>();
  for (const m of liveMatches) {
    for (const b of m.bets) {
      const result = classifyBet(
        { home: b.homeGuess, away: b.awayGuess },
        { home: m.home, away: m.away, finished: true },
      );
      const pts = pointsForResult(result, rule);
      if (pts > 0) acc.set(b.userId, (acc.get(b.userId) ?? 0) + pts);
    }
  }
  return acc;
}

/**
 * Mescla o consolidado com o overlay ao vivo e reordena. Desempate estável:
 * total desc → consolidado desc → nome (pt-BR). As contagens hits/misses/exactHits
 * NÃO mudam ao vivo (jogo em andamento não tem "erro" definitivo).
 */
export function mergeLiveRanking(
  base: RankingBase[],
  livePointsByUser: Map<string, number>,
): RankingRow[] {
  const rows = base.map((b) => {
    const livePoints = livePointsByUser.get(b.userId) ?? 0;
    return {
      ...b,
      livePoints,
      totalPoints: b.consolidatedPoints + livePoints,
      isLive: livePoints > 0,
    };
  });

  rows.sort(
    (a, b) =>
      b.totalPoints - a.totalPoints ||
      b.consolidatedPoints - a.consolidatedPoints ||
      (a.name ?? "").localeCompare(b.name ?? "", "pt-BR"),
  );

  return rows.map((r, i) => ({ ...r, position: i + 1 }));
}
