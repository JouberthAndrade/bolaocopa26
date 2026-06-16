// Montagem das linhas de "Confronto": dado o conjunto de participantes do bolão
// e os palpites de um jogo revelado (10 min antes do início, ao vivo ou já
// encerrado), produz uma lista ordenada para exibir quem palpitou o quê e
// quanto pontuou. Função PURA — sem banco — para ser testável e reutilizável.
// A pontuação vem de Bet.pointsEarned (servidor); aqui só ordenamos e
// classificamos o resultado para a UI.

import {
  classifyBet,
  pointsForResult,
  type BetResult,
  type ResultScoringRule,
} from "@/lib/bet-result";
import type { BotKind } from "@prisma/client";

export interface MatchupMember {
  userId: string;
  name: string | null;
  image: string | null;
  /** true para os palpiteiros de IA (Claudinho/Gepeto) */
  isBot?: boolean;
  /** identidade do bot, quando isBot — define o layout diferenciado */
  botKind?: BotKind | null;
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
  isBot: boolean;
  botKind: BotKind | null;
  /** palpite do participante, ou null se ele não palpitou este jogo */
  guess: { home: number; away: number } | null;
  points: number;
  /** classificação do palpite (exato/acertou/errou); null quando não palpitou */
  result: BetResult | null;
}

/**
 * Ordena por pontos (desc); empate vai para placar exato primeiro e depois
 * nome (asc). Quem não palpitou aparece por último, ordenado por nome.
 * `actual` é null quando o jogo ainda não tem placar (revelado antes de
 * começar) — nesse caso não há classificação de resultado.
 */
export function buildMatchupRows(
  members: MatchupMember[],
  bets: MatchupBet[],
  actual: { home: number; away: number } | null,
): MatchupRow[] {
  const byUser = new Map(bets.map((b) => [b.userId, b]));

  const rows: MatchupRow[] = members.map((m) => {
    const base = {
      userId: m.userId,
      name: m.name,
      image: m.image,
      isBot: m.isBot ?? false,
      botKind: m.botKind ?? null,
    };
    const bet = byUser.get(m.userId);
    if (!bet) {
      return { ...base, guess: null, points: 0, result: null };
    }
    return {
      ...base,
      guess: { home: bet.homeGuess, away: bet.awayGuess },
      points: bet.pointsEarned,
      result: actual
        ? classifyBet(
            { home: bet.homeGuess, away: bet.awayGuess },
            { home: actual.home, away: actual.away, finished: true },
          )
        : null,
    };
  });

  return rows.sort(compareMatchupRows);
}

/**
 * Ordena por pontos (desc); empate vai para placar exato primeiro e depois
 * nome (asc). Quem não palpitou aparece por último, ordenado por nome.
 */
function compareMatchupRows(a: MatchupRow, b: MatchupRow): number {
  const nameOf = (r: MatchupRow) => (r.name ?? "").toLocaleLowerCase("pt-BR");

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
}

/**
 * Pontuação PROVISÓRIA no client enquanto o jogo está em andamento: recalcula
 * `points` de cada linha a partir do `result` já classificado e da regra do
 * bolão (Bet.pointsEarned só é persistido pelo servidor após o jogo encerrar),
 * e reordena pelo novo placar. Não toca no backend.
 */
export function withProvisionalPoints(
  rows: MatchupRow[],
  rule: ResultScoringRule,
): MatchupRow[] {
  return rows
    .map((r) => ({ ...r, points: pointsForResult(r.result, rule) }))
    .sort(compareMatchupRows);
}

/** Ordem fixa dos bots na seção de IA. */
const BOT_ORDER: BotKind[] = ["CLAUDINHO", "GEPETO"];

/**
 * Separa as linhas em bots (palpiteiros de IA) e humanos. Os humanos preservam a
 * ordem de `buildMatchupRows` (por pontos); os bots saem na ordem fixa BOT_ORDER
 * para um layout estável na seção "Inteligência Artificial".
 */
export function splitBotRows(rows: MatchupRow[]): {
  bots: MatchupRow[];
  humans: MatchupRow[];
} {
  const bots = rows
    .filter((r) => r.isBot)
    .sort((a, b) => {
      const ai = a.botKind ? BOT_ORDER.indexOf(a.botKind) : BOT_ORDER.length;
      const bi = b.botKind ? BOT_ORDER.indexOf(b.botKind) : BOT_ORDER.length;
      return ai - bi;
    });
  const humans = rows.filter((r) => !r.isBot);
  return { bots, humans };
}
