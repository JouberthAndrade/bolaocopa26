import { describe, it, expect } from "vitest";
import { computeBetPoints } from "./scoring";

// Regra padrão do bolão (ScoringRule): resultado=2 (vitória ou empate),
// bônus placar exato=+1 → placar exato vale 3.
const rule = { pointsCorrectResult: 2, pointsCorrectDraw: 2, pointsExactScore: 1 };

describe("computeBetPoints — exemplos da especificação", () => {
  it("palpite 1x0, real 1x0 → placar exato = 3", () => {
    expect(computeBetPoints(rule, { home: 1, away: 0 }, { home: 1, away: 0 })).toBe(3);
  });

  it("palpite 2x0, real 1x0 → acertou o resultado = 2", () => {
    expect(computeBetPoints(rule, { home: 2, away: 0 }, { home: 1, away: 0 })).toBe(2);
  });

  it("palpite 2x2, real 1x1 → acertou o empate sem placar = 2", () => {
    expect(computeBetPoints(rule, { home: 2, away: 2 }, { home: 1, away: 1 })).toBe(2);
  });

  it("palpite 2x2, real 2x2 → empate com placar exato = 3", () => {
    expect(computeBetPoints(rule, { home: 2, away: 2 }, { home: 2, away: 2 })).toBe(3);
  });
});

describe("computeBetPoints — erros", () => {
  it("palpite 1x1, real 2x1 → errou = 0", () => {
    expect(computeBetPoints(rule, { home: 1, away: 1 }, { home: 2, away: 1 })).toBe(0);
  });

  it("previu vitória mas deu empate → 0", () => {
    expect(computeBetPoints(rule, { home: 2, away: 1 }, { home: 1, away: 1 })).toBe(0);
  });

  it("inverteu o vencedor → 0", () => {
    expect(computeBetPoints(rule, { home: 0, away: 2 }, { home: 2, away: 0 })).toBe(0);
  });
});

describe("computeBetPoints — regras configuráveis (sem hardcode)", () => {
  it("respeita pontuação customizada do bolão", () => {
    const custom = { pointsCorrectResult: 5, pointsCorrectDraw: 4, pointsExactScore: 3 };
    // vencedor + exato = 5 + 3
    expect(computeBetPoints(custom, { home: 3, away: 0 }, { home: 3, away: 0 })).toBe(8);
    // só vencedor = 5
    expect(computeBetPoints(custom, { home: 1, away: 0 }, { home: 3, away: 0 })).toBe(5);
    // empate exato = 4 + 3
    expect(computeBetPoints(custom, { home: 2, away: 2 }, { home: 2, away: 2 })).toBe(7);
  });
});

describe("computeBetPoints — bônus de pênaltis (mata-mata)", () => {
  // Jogo real foi aos pênaltis: actual é empate (1x1) e penaltyWinner definido.
  it("empate certo + acertou quem passou → base empate (2) + bônus (1) = 3", () => {
    expect(
      computeBetPoints(rule, { home: 1, away: 1 }, { home: 1, away: 1 }, {
        betAdvances: "HOME",
        penaltyWinner: "HOME",
        bonus: 1,
      }),
    ).toBe(3);
  });

  it("empate certo + errou quem passou → só base empate (2)", () => {
    expect(
      computeBetPoints(rule, { home: 1, away: 1 }, { home: 1, away: 1 }, {
        betAdvances: "AWAY",
        penaltyWinner: "HOME",
        bonus: 1,
      }),
    ).toBe(2);
  });

  it("jogo não foi aos pênaltis (penaltyWinner null) → sem bônus", () => {
    expect(
      computeBetPoints(rule, { home: 1, away: 1 }, { home: 1, away: 1 }, {
        betAdvances: "HOME",
        penaltyWinner: null,
        bonus: 1,
      }),
    ).toBe(2);
  });

  it("palpite não foi empate → sem bônus mesmo com penaltyWinner", () => {
    // previu 2x1 (vitória mandante) num jogo que terminou 1x1 nos pênaltis:
    // erra a base (0) e não recebe bônus.
    expect(
      computeBetPoints(rule, { home: 2, away: 1 }, { home: 1, away: 1 }, {
        betAdvances: "HOME",
        penaltyWinner: "HOME",
        bonus: 1,
      }),
    ).toBe(0);
  });

  it("sem o 4º parâmetro, comportamento antigo é preservado", () => {
    expect(computeBetPoints(rule, { home: 1, away: 1 }, { home: 1, away: 1 })).toBe(3);
  });
});
