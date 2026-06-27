/** Teto máximo para palpites de bônus (campeão / vice / artilheiro):
 *  16:00 BRT de 11/06/2026, início da Copa. Nenhum bolão pode aceitar
 *  palpite de bônus depois disso, mesmo com entryDeadline maior. */
export const BONUS_DEADLINE = new Date("2026-06-11T19:00:00.000Z"); // 16:00 BRT de 11/06

/** Prazo efetivo dos palpites de bônus de um bolão: o entryDeadline
 *  configurado, limitado ao teto BONUS_DEADLINE (o que vier primeiro). */
export function bonusDeadlineFor(entryDeadline: Date | null | undefined): Date {
  return entryDeadline && entryDeadline < BONUS_DEADLINE ? entryDeadline : BONUS_DEADLINE;
}

/** Antecedência com que os palpites dos participantes são revelados no
 *  Confronto: 10 minutos antes do início da partida (16:00 → visível às 15:50). */
export const REVEAL_BEFORE_KICKOFF_MS = 10 * 60 * 1000;

/** Instante em que os palpites de um jogo ficam visíveis. Nunca antes do
 *  travamento (lockAt), para jamais revelar palpite ainda editável. */
export function matchRevealAt(kickoffAt: Date, lockAt: Date): Date {
  const reveal = new Date(kickoffAt.getTime() - REVEAL_BEFORE_KICKOFF_MS);
  return reveal > lockAt ? reveal : lockAt;
}

/** Liberação dos palpites do mata-mata: 27/06/2026 às 23h BRT = 02:00 UTC de 28/06. */
export const KNOCKOUT_UNLOCK_DATE = new Date("2026-06-28T02:00:00.000Z");

/** Bônus por acertar quem avança nos pênaltis num jogo de mata-mata decidido
 *  no shootout. Fixo (não configurável por bolão). */
export const POINTS_PENALTY_ADVANCE = 1;
