import { describe, it, expect } from "vitest";
import { buildMatchupRows, type MatchupMember, type MatchupBet } from "./matchup";

const members: MatchupMember[] = [
  { userId: "ana", name: "Ana", image: null },
  { userId: "bruno", name: "Bruno", image: null },
  { userId: "carla", name: "Carla", image: null },
  { userId: "diego", name: "Diego", image: null },
];

// Jogo real: 2 x 0
const actual = { home: 2, away: 0 };

describe("buildMatchupRows", () => {
  it("ordena por pontos (desc)", () => {
    const bets: MatchupBet[] = [
      { userId: "ana", homeGuess: 1, awayGuess: 0, pointsEarned: 3 },
      { userId: "bruno", homeGuess: 2, awayGuess: 0, pointsEarned: 4 },
      { userId: "carla", homeGuess: 0, awayGuess: 1, pointsEarned: 0 },
    ];
    const rows = buildMatchupRows(members.slice(0, 3), bets, actual);
    expect(rows.map((r) => r.userId)).toEqual(["bruno", "ana", "carla"]);
  });

  it("inclui quem não palpitou, sempre por último e por nome", () => {
    const bets: MatchupBet[] = [
      { userId: "diego", homeGuess: 2, awayGuess: 0, pointsEarned: 4 },
    ];
    const rows = buildMatchupRows(members, bets, actual);
    // Diego pontuou; Ana/Bruno/Carla não palpitaram → por último em ordem alfabética
    expect(rows.map((r) => r.userId)).toEqual(["diego", "ana", "bruno", "carla"]);
    expect(rows[1].guess).toBeNull();
    expect(rows[1].result).toBeNull();
    expect(rows[1].points).toBe(0);
  });

  it("desempata pontuação igual com placar exato primeiro", () => {
    // Empate em pontos entre acerto de vencedor (3) — mas um é exato? Não.
    // Usamos dois com mesma pontuação onde um é EXACT.
    const bets: MatchupBet[] = [
      { userId: "ana", homeGuess: 3, awayGuess: 1, pointsEarned: 3 }, // só vencedor
      { userId: "bruno", homeGuess: 2, awayGuess: 0, pointsEarned: 3 }, // exato (mesma pontuação fictícia)
    ];
    const rows = buildMatchupRows(members.slice(0, 2), bets, actual);
    expect(rows[0].userId).toBe("bruno");
    expect(rows[0].result?.kind).toBe("EXACT");
  });

  it("classifica o resultado de cada palpite", () => {
    const bets: MatchupBet[] = [
      { userId: "ana", homeGuess: 2, awayGuess: 0, pointsEarned: 4 },
      { userId: "bruno", homeGuess: 1, awayGuess: 0, pointsEarned: 3 },
      { userId: "carla", homeGuess: 0, awayGuess: 2, pointsEarned: 0 },
    ];
    const rows = buildMatchupRows(members.slice(0, 3), bets, actual);
    const byId = Object.fromEntries(rows.map((r) => [r.userId, r]));
    expect(byId.ana.result?.kind).toBe("EXACT");
    expect(byId.bruno.result?.kind).toBe("RESULT");
    expect(byId.carla.result?.kind).toBe("MISS");
  });
});
