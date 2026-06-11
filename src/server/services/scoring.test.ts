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
