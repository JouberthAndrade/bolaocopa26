import type { MatchStage, MatchStatus } from "@prisma/client";

/**
 * Jogo fechado para palpite: travado pelo horário (lockAt) ou já não-agendado.
 * Esta é a ÚNICA autoridade de liberação por jogo — vale para grupos e
 * mata-mata. Como o sync só cria Match com os dois times resolvidos, todo jogo
 * de mata-mata no banco já tem confronto definido e pode ser palpitado até o
 * lockAt. Confrontos indefinidos existem apenas como partidas virtuais
 * (não persistidas), que nem chegam ao upsertBet.
 */
export function isBetClosed(
  match: { lockAt: Date; status: MatchStatus },
  now: Date = new Date(),
): boolean {
  return now >= match.lockAt || match.status !== "SCHEDULED";
}

/**
 * True quando o palpite é um empate num jogo de mata-mata — caso em que o
 * usuário precisa escolher quem avança nos pênaltis. Em grupos, empate é
 * resultado final válido e não exige escolha.
 */
export function isKnockoutDraw(
  stage: MatchStage,
  homeGuess: number,
  awayGuess: number,
): boolean {
  return stage !== "GROUP" && homeGuess === awayGuess;
}
