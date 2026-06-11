/** Prazo máximo para palpites de bônus (campeão / vice / artilheiro).
 *  A Copa 2026 começa em 11/06/2026 — palpites encerram à meia-noite BRT do dia anterior. */
export const BONUS_DEADLINE = new Date("2026-06-11T03:00:00.000Z"); // 00:00 BRT de 11/06

/** Antecedência com que os palpites dos participantes são revelados no
 *  Confronto: 10 minutos antes do início da partida (16:00 → visível às 15:50). */
export const REVEAL_BEFORE_KICKOFF_MS = 10 * 60 * 1000;

/** Instante em que os palpites de um jogo ficam visíveis. Nunca antes do
 *  travamento (lockAt), para jamais revelar palpite ainda editável. */
export function matchRevealAt(kickoffAt: Date, lockAt: Date): Date {
  const reveal = new Date(kickoffAt.getTime() - REVEAL_BEFORE_KICKOFF_MS);
  return reveal > lockAt ? reveal : lockAt;
}
