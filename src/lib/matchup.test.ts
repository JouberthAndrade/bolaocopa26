import { describe, it, expect } from "vitest";
import {
  buildMatchupRows,
  splitBotRows,
  withProvisionalPoints,
  type MatchupMember,
  type MatchupBet,
} from "./matchup";
import type { ResultScoringRule } from "./bet-result";

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

  it("sem placar (revelado antes do jogo) → mostra palpites sem classificar", () => {
    const bets: MatchupBet[] = [
      { userId: "ana", homeGuess: 2, awayGuess: 0, pointsEarned: 0 },
      { userId: "bruno", homeGuess: 1, awayGuess: 1, pointsEarned: 0 },
    ];
    const rows = buildMatchupRows(members.slice(0, 3), bets, null);
    const byId = Object.fromEntries(rows.map((r) => [r.userId, r]));
    expect(byId.ana.guess).toEqual({ home: 2, away: 0 });
    expect(byId.ana.result).toBeNull();
    expect(byId.bruno.result).toBeNull();
    // quem não palpitou continua por último
    expect(rows[rows.length - 1].userId).toBe("carla");
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

describe("withProvisionalPoints", () => {
  const rule: ResultScoringRule = {
    pointsExactScore: 1,
    pointsCorrectResult: 2,
    pointsCorrectDraw: 2,
  };

  it("pontua ao vivo mesmo com pointsEarned ainda zerado no servidor", () => {
    // Jogo em andamento empatado 0 x 0: pointsEarned não foi persistido (0).
    const live = { home: 0, away: 0 };
    const bets: MatchupBet[] = [
      { userId: "ana", homeGuess: 0, awayGuess: 0, pointsEarned: 0 }, // exato (empate)
      { userId: "bruno", homeGuess: 1, awayGuess: 1, pointsEarned: 0 }, // acertou empate
      { userId: "carla", homeGuess: 2, awayGuess: 0, pointsEarned: 0 }, // errou
    ];
    const rows = withProvisionalPoints(
      buildMatchupRows(members.slice(0, 3), bets, live),
      rule,
    );
    const byId = Object.fromEntries(rows.map((r) => [r.userId, r]));
    expect(byId.ana.points).toBe(3); // 2 (empate) + 1 (bônus exato)
    expect(byId.bruno.points).toBe(2);
    expect(byId.carla.points).toBe(0);
    // reordena pelo placar provisório: exato primeiro
    expect(rows.map((r) => r.userId)).toEqual(["ana", "bruno", "carla"]);
  });

  it("não pontua quem não palpitou nem palpite sem placar", () => {
    const rows = withProvisionalPoints(
      buildMatchupRows(members.slice(0, 2), [], null),
      rule,
    );
    expect(rows.every((r) => r.points === 0)).toBe(true);
  });
});

describe("splitBotRows", () => {
  const botMembers: MatchupMember[] = [
    { userId: "claudinho", name: "Claudinho", image: null, isBot: true, botKind: "CLAUDINHO" },
    { userId: "gepeto", name: "Gepeto", image: null, isBot: true, botKind: "GEPETO" },
    { userId: "ana", name: "Ana", image: null },
    { userId: "bruno", name: "Bruno", image: null },
  ];

  it("separa bots dos humanos preservando a ordem das linhas humanas", () => {
    const bets: MatchupBet[] = [
      { userId: "claudinho", homeGuess: 2, awayGuess: 0, pointsEarned: 4 },
      { userId: "gepeto", homeGuess: 2, awayGuess: 1, pointsEarned: 3 },
      { userId: "ana", homeGuess: 1, awayGuess: 0, pointsEarned: 3 },
      { userId: "bruno", homeGuess: 0, awayGuess: 0, pointsEarned: 0 },
    ];
    const rows = buildMatchupRows(botMembers, bets, actual);
    const { bots, humans } = splitBotRows(rows);

    expect(bots.map((r) => r.userId).sort()).toEqual(["claudinho", "gepeto"]);
    expect(humans.map((r) => r.userId)).toEqual(["ana", "bruno"]);
    // ordena bots por kind: Claudinho antes de Gepeto
    expect(bots.map((r) => r.botKind)).toEqual(["CLAUDINHO", "GEPETO"]);
  });

  it("retorna bots vazio quando não há bots", () => {
    const rows = buildMatchupRows(members.slice(0, 2), [], actual);
    const { bots, humans } = splitBotRows(rows);
    expect(bots).toHaveLength(0);
    expect(humans).toHaveLength(2);
  });
});
