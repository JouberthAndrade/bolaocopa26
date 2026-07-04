import type { Advance, MatchStatus } from "@prisma/client";

/** Estado atual do jogo no banco (campos relevantes ao resultado). */
export interface StoredResult {
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
  resultConfirmed: boolean;
  scored: boolean;
}

/** Resultado que o provedor (Football-Data) está reportando agora. */
export interface ProviderResult {
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
}

/**
 * Decisão de escrita do resultado para um jogo.
 * - `locked: true`  → resultado já confirmado; NÃO sobrescrever placar/status.
 * - `locked: false` → escrever os campos de resultado abaixo.
 */
export type ResultDecision =
  | { locked: true }
  | {
      locked: false;
      status: MatchStatus;
      homeScore: number | null;
      awayScore: number | null;
      resultConfirmed: boolean;
      /** quando definido, força re-pontuar (placar mudou após já pontuado). */
      scored?: boolean;
    };

function isFinishedWithScore(r: { status: MatchStatus; homeScore: number | null; awayScore: number | null }): boolean {
  return r.status === "FINISHED" && r.homeScore != null && r.awayScore != null;
}

/**
 * Double-check de resultado para evitar pontuação com placar provisório
 * (ex.: gol anulado pelo VAR depois que a API já marcou FINISHED).
 *
 * Regra: um placar FINISHED só é "confirmado" quando observado IGUAL em dois
 * ticks consecutivos do sync. Enquanto não confirmado, seguimos rastreando o
 * placar do provedor — assim uma correção tardia (VAR) entra e re-arma a
 * pontuação. Depois de confirmado, o resultado é imutável (locked).
 *
 * Não faz nenhuma chamada extra à API: usa o mesmo fetch em massa do cron,
 * apenas adia o "travamento" em um tick (~15min), janela suficiente para
 * correções oficiais/VAR aparecerem na fonte.
 */
export function decideResultWrite(
  existing: StoredResult | null,
  provider: ProviderResult,
): ResultDecision {
  // Já confirmado anteriormente → imutável.
  if (existing?.resultConfirmed) {
    return { locked: true };
  }

  // Segunda observação consecutiva de FINISHED com o MESMO placar → confirma.
  const confirmed =
    existing != null &&
    existing.status === "FINISHED" &&
    isFinishedWithScore(provider) &&
    existing.homeScore === provider.homeScore &&
    existing.awayScore === provider.awayScore;

  // Placar mudou em relação ao que estava salvo: se já havia sido pontuado,
  // precisamos re-armar a pontuação (cobre correção de VAR pós-pontuação e o
  // backfill de jogos antigos).
  const scoreChanged =
    existing != null &&
    (existing.homeScore !== provider.homeScore || existing.awayScore !== provider.awayScore);
  const rearmScoring = scoreChanged && existing!.scored;

  return {
    locked: false,
    status: provider.status,
    homeScore: provider.homeScore,
    awayScore: provider.awayScore,
    resultConfirmed: confirmed,
    ...(rearmScoring ? { scored: false } : {}),
  };
}

/**
 * Backfill do vencedor dos pênaltis: mesmo com o resultado travado (locked),
 * um jogo que ficou sem `penaltyWinner` (ex.: correção manual de placar que
 * não informou o campo) pode recebê-lo do provedor. Só preenche quando o banco
 * está null — nunca sobrescreve valor existente (manual é autoritativo). Se o
 * jogo já foi pontuado, re-arma o scoring para aplicar o bônus de mata-mata.
 */
export function decidePenaltyWinnerWrite(
  existing: { penaltyWinner: Advance | null; scored: boolean } | null,
  providerPenaltyWinner: Advance | null,
): { penaltyWinner: Advance; scored?: false } | null {
  if (!existing) return null;
  if (existing.penaltyWinner != null || providerPenaltyWinner == null) return null;
  return existing.scored
    ? { penaltyWinner: providerPenaltyWinner, scored: false }
    : { penaltyWinner: providerPenaltyWinner };
}
