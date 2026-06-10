"use server";

import { requireUserId, requireMembership } from "@/server/guards";
import { getMatchupDetail, type MatchupDetail } from "@/server/services/matchups";

type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Carrega os palpites de todos os participantes para um jogo. Usado pela aba
 * "Confronto" sob demanda, ao abrir o modal de um jogo encerrado. Exige que o
 * solicitante seja membro do bolão.
 */
export async function loadMatchupDetail(
  poolId: string,
  matchId: string,
): Promise<ActionResult<MatchupDetail>> {
  const userId = await requireUserId();
  try {
    await requireMembership(poolId, userId);
  } catch {
    return { ok: false, error: "Acesso negado" };
  }

  const detail = await getMatchupDetail(poolId, matchId);
  if (!detail) return { ok: false, error: "Palpites indisponíveis para este jogo" };

  return { ok: true, data: detail };
}
