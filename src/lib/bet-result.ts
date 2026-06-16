// Classificação do resultado de um palpite — função PURA, sem dependência de
// banco ou de ScoringRule. Serve tanto no servidor quanto no client (UI),
// para exibir o badge correto abaixo do palpite. A pontuação em si continua
// vindo de Bet.pointsEarned (calculado no servidor com a ScoringRule do bolão).

export type BetResultKind = "PENDING" | "EXACT" | "RESULT" | "MISS";

export interface BetResult {
  kind: BetResultKind;
  /** rótulo pronto para a UI, em PT-BR */
  label: string;
  /** true quando acertou o empate (RESULT em jogo empatado) */
  isDraw: boolean;
}

type Score = { home: number; away: number };

function outcome({ home, away }: Score): "HOME" | "AWAY" | "DRAW" {
  if (home > away) return "HOME";
  if (home < away) return "AWAY";
  return "DRAW";
}

/**
 * Classifica o palpite contra o resultado oficial.
 * `actual` é null/indefinido enquanto o jogo não tiver placar → PENDING.
 */
export function classifyBet(
  guess: Score | null | undefined,
  actual: { home: number | null; away: number | null; finished: boolean },
): BetResult {
  if (
    !guess ||
    !actual.finished ||
    actual.home == null ||
    actual.away == null
  ) {
    return { kind: "PENDING", label: "Aguardando resultado", isDraw: false };
  }

  const real: Score = { home: actual.home, away: actual.away };
  const exact = guess.home === real.home && guess.away === real.away;
  if (exact) {
    return { kind: "EXACT", label: "Acertou o placar exato", isDraw: outcome(real) === "DRAW" };
  }

  if (outcome(guess) === outcome(real)) {
    const isDraw = outcome(real) === "DRAW";
    return {
      kind: "RESULT",
      label: isDraw ? "Acertou o empate" : "Acertou o vencedor",
      isDraw,
    };
  }

  return { kind: "MISS", label: "Não pontuou", isDraw: false };
}

/** Campos da ScoringRule necessários para pontuar um palpite (sem bônus). */
export interface ResultScoringRule {
  pointsExactScore: number;
  pointsCorrectResult: number;
  pointsCorrectDraw: number;
}

/**
 * Pontos de um BetResult conforme a regra do bolão — espelha
 * computeBetPoints (servidor), mas PURO e sem dependência de banco, para
 * pontuar provisoriamente no client enquanto o jogo está em andamento.
 */
export function pointsForResult(
  result: BetResult | null | undefined,
  rule: ResultScoringRule,
): number {
  if (!result) return 0;
  const base = result.isDraw ? rule.pointsCorrectDraw : rule.pointsCorrectResult;
  if (result.kind === "EXACT") return base + rule.pointsExactScore;
  if (result.kind === "RESULT") return base;
  return 0;
}
