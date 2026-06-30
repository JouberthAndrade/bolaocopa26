import type { Advance } from "@prisma/client";

/**
 * Deriva o vencedor do shootout a partir do bloco `score` da Football-Data.
 * Só retorna HOME/AWAY quando o jogo foi `PENALTY_SHOOTOUT`; nos demais casos
 * (tempo normal, prorrogação) retorna null — o resultado fica em fullTime.
 */
export function mapPenaltyWinner(score: {
  winner?: string | null;
  duration?: string | null;
}): Advance | null {
  if (score.duration !== "PENALTY_SHOOTOUT") return null;
  if (score.winner === "HOME_TEAM") return "HOME";
  if (score.winner === "AWAY_TEAM") return "AWAY";
  return null;
}

interface ScoreLine {
  home: number | null;
  away: number | null;
}

/**
 * Resolve o placar do confronto a ser gravado/pontuado — SEM contar os pênaltis.
 *
 * - `PENALTY_SHOOTOUT`: o jogo terminou empatado e foi decidido nas penalidades.
 *   A Football-Data SOMA o shootout no `fullTime` (ex.: 1-1 no tempo normal +
 *   2-3 nos pênaltis = 3-4), então usamos `regularTime` (o empate de fato). O
 *   vencedor do confronto vem de `mapPenaltyWinner` → bônus em computeBetPoints.
 * - `REGULAR` / `EXTRA_TIME`: `fullTime` já é o placar correto (inclui os gols da
 *   prorrogação quando houver, e não tem pênaltis para somar).
 */
export function resolveMatchScore(score: {
  winner?: string | null;
  duration?: string | null;
  fullTime?: ScoreLine | null;
  regularTime?: ScoreLine | null;
}): ScoreLine {
  if (score.duration === "PENALTY_SHOOTOUT" && score.regularTime) {
    return { home: score.regularTime.home, away: score.regularTime.away };
  }
  return { home: score.fullTime?.home ?? null, away: score.fullTime?.away ?? null };
}
