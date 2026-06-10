// Montagem das linhas de "Confronto": dado o conjunto de participantes do bolão
// e os palpites de um jogo já finalizado, produz uma lista ordenada para exibir
// quem palpitou o quê e quanto pontuou. Função PURA — sem banco — para ser
// testável e reutilizável. A pontuação vem de Bet.pointsEarned (servidor);
// aqui só ordenamos e classificamos o resultado para a UI.

import { classifyBet, type BetResult } from "@/lib/bet-result";

export interface MatchupMember {
  userId: string;
  name: string | null;
  image: string | null;
}

export interface MatchupBet {
  userId: string;
  homeGuess: number;
  awayGuess: number;
  pointsEarned: number;
}

export interface MatchupRow {
  userId: string;
  name: string | null;
  image: string | null;
  /** palpite do participante, ou null se ele não palpitou este jogo */
  guess: { home: number; away: number } | null;
  points: number;
  /** classificação do palpite (exato/acertou/errou); null quando não palpitou */
  result: BetResult | null;
}

/**
 * Ordena por pontos (desc); empate vai para placar exato primeiro e depois
 * nome (asc). Quem não palpitou aparece por último, ordenado por nome.
 */
export function buildMatchupRows(
  members: MatchupMember[],
  bets: MatchupBet[],
  actual: { home: number; away: number },
): MatchupRow[] {
  const byUser = new Map(bets.map((b) => [b.userId, b]));

  const rows: MatchupRow[] = members.map((m) => {
    const bet = byUser.get(m.userId);
    if (!bet) {
      return { ...m, guess: null, points: 0, result: null };
    }
    return {
      userId: m.userId,
      name: m.name,
      image: m.image,
      guess: { home: bet.homeGuess, away: bet.awayGuess },
      points: bet.pointsEarned,
      result: classifyBet(
        { home: bet.homeGuess, away: bet.awayGuess },
        { home: actual.home, away: actual.away, finished: true },
      ),
    };
  });

  const nameOf = (r: MatchupRow) => (r.name ?? "").toLocaleLowerCase("pt-BR");

  return rows.sort((a, b) => {
    // não-palpitantes sempre por último
    const aNone = a.guess === null;
    const bNone = b.guess === null;
    if (aNone !== bNone) return aNone ? 1 : -1;
    if (aNone && bNone) return nameOf(a).localeCompare(nameOf(b), "pt-BR");

    if (b.points !== a.points) return b.points - a.points;

    // desempate: placar exato primeiro
    const aExact = a.result?.kind === "EXACT" ? 0 : 1;
    const bExact = b.result?.kind === "EXACT" ? 0 : 1;
    if (aExact !== bExact) return aExact - bExact;

    return nameOf(a).localeCompare(nameOf(b), "pt-BR");
  });
}
