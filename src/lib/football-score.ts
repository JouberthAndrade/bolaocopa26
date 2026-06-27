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
