import { describe, it, expect } from "vitest";
import { computeBetPoints } from "./scoring";

// Regra padrão do bolão (ScoringRule): vitória=3, empate=2, bônus placar exato=+1.
const rule = { pointsCorrectResult: 3, pointsCorrectDraw: 2, pointsExactScore: 1 };

describe("computeBetPoints — exemplos da especificação", () => {
  it("Brasil 2x1, real 2x1 → vencedor + placar exato = 4", () => {
    expect(computeBetPoints(rule, { home: 2, away: 1 }, { home: 2, away: 1 })).toBe(4);
  });

  it("Brasil 1x0, real 2x1 → só vencedor = 3", () => {
    expect(computeBetPoints(rule, { home: 1, away: 0 }, { home: 2, away: 1 })).toBe(3);
  });

  it("Brasil 1x1, real 2x1 → errou = 0", () => {
    expect(computeBetPoints(rule, { home: 1, away: 1 }, { home: 2, away: 1 })).toBe(0);
  });
});

describe("computeBetPoints — empates e bônus", () => {
  it("empate exato → empate + bônus = 3", () => {
    expect(computeBetPoints(rule, { home: 1, away: 1 }, { home: 1, away: 1 })).toBe(3);
  });

  it("acertou empate sem placar exato → 2", () => {
    expect(computeBetPoints(rule, { home: 0, away: 0 }, { home: 2, away: 2 })).toBe(2);
  });

  it("previu vitória mas deu empate → 0", () => {
    expect(computeBetPoints(rule, { home: 2, away: 1 }, { home: 1, away: 1 })).toBe(0);
  });

  it("vitória do visitante, exata → 4", () => {
    expect(computeBetPoints(rule, { home: 0, away: 2 }, { home: 0, away: 2 })).toBe(4);
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
