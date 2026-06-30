import type { RankingRow } from "./live-ranking";

export interface PositionSummary {
  /** Linha do usuário atual no ranking, ou null se ele não estiver na lista. */
  me: RankingRow | null;
  /** Os três primeiros colocados (menos, se o bolão tiver menos gente). */
  top3: RankingRow[];
  /** Total de participantes no ranking. */
  total: number;
}

/**
 * Deriva o resumo de posição para o hub a partir do ranking já ordenado
 * (saída de getRanking). Função pura — sem banco, fácil de testar.
 */
export function derivePositionSummary(
  rows: RankingRow[],
  userId: string,
): PositionSummary {
  return {
    me: rows.find((r) => r.userId === userId) ?? null,
    top3: rows.slice(0, 3),
    total: rows.length,
  };
}
