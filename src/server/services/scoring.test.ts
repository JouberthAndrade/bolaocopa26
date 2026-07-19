import { describe, it, expect } from "vitest";
import { computeBetPoints, resolveFinalWinner, normalizePlayerName } from "./scoring";

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
  // Palpite 2x2 (acertou o empate, sem placar exato) isola o bônus de pênaltis.
  it("empate certo (sem exato) + acertou quem passou → 2 + 1 = 3", () => {
    expect(
      computeBetPoints(rule, { home: 2, away: 2 }, { home: 1, away: 1 }, {
        betAdvances: "HOME",
        penaltyWinner: "HOME",
        bonus: 1,
      }),
    ).toBe(3);
  });

  it("empate certo (sem exato) + errou quem passou → só base empate (2)", () => {
    expect(
      computeBetPoints(rule, { home: 2, away: 2 }, { home: 1, away: 1 }, {
        betAdvances: "AWAY",
        penaltyWinner: "HOME",
        bonus: 1,
      }),
    ).toBe(2);
  });

  it("jogo não foi aos pênaltis (penaltyWinner null) → sem bônus", () => {
    expect(
      computeBetPoints(rule, { home: 2, away: 2 }, { home: 1, away: 1 }, {
        betAdvances: "HOME",
        penaltyWinner: null,
        bonus: 1,
      }),
    ).toBe(2);
  });

  it("placar exato no empate + acertou quem passou → 2 + 1 (exato) + 1 (pênaltis) = 4", () => {
    expect(
      computeBetPoints(rule, { home: 1, away: 1 }, { home: 1, away: 1 }, {
        betAdvances: "HOME",
        penaltyWinner: "HOME",
        bonus: 1,
      }),
    ).toBe(4);
  });

  it("palpite não foi empate → sem bônus mesmo com penaltyWinner", () => {
    expect(
      computeBetPoints(rule, { home: 2, away: 1 }, { home: 1, away: 1 }, {
        betAdvances: "HOME",
        penaltyWinner: "HOME",
        bonus: 1,
      }),
    ).toBe(0);
  });

  it("bônus de placar exato continua valendo com o 4º parâmetro presente (sem pênaltis)", () => {
    // Regressão: a presença do 4º parâmetro não pode anular o bônus de exato comum.
    expect(
      computeBetPoints(rule, { home: 2, away: 0 }, { home: 2, away: 0 }, {
        betAdvances: null,
        penaltyWinner: null,
        bonus: 1,
      }),
    ).toBe(3);
  });

  it("sem o 4º parâmetro, comportamento antigo é preservado (placar exato no empate)", () => {
    expect(computeBetPoints(rule, { home: 1, away: 1 }, { home: 1, away: 1 })).toBe(3);
  });
});

describe("resolveFinalWinner — bônus campeão/vice a partir da Final", () => {
  it("mandante vence no tempo normal → mandante é campeão", () => {
    expect(
      resolveFinalWinner({
        homeTeamId: "esp",
        awayTeamId: "arg",
        homeScore: 2,
        awayScore: 1,
        penaltyWinner: null,
      }),
    ).toEqual({ championTeamId: "esp", runnerUpTeamId: "arg" });
  });

  it("visitante vence no tempo normal → visitante é campeão", () => {
    expect(
      resolveFinalWinner({
        homeTeamId: "esp",
        awayTeamId: "arg",
        homeScore: 0,
        awayScore: 1,
        penaltyWinner: null,
      }),
    ).toEqual({ championTeamId: "arg", runnerUpTeamId: "esp" });
  });

  it("empate decidido nos pênaltis para o mandante → mandante é campeão", () => {
    expect(
      resolveFinalWinner({
        homeTeamId: "esp",
        awayTeamId: "arg",
        homeScore: 1,
        awayScore: 1,
        penaltyWinner: "HOME",
      }),
    ).toEqual({ championTeamId: "esp", runnerUpTeamId: "arg" });
  });

  it("empate decidido nos pênaltis para o visitante → visitante é campeão", () => {
    expect(
      resolveFinalWinner({
        homeTeamId: "esp",
        awayTeamId: "arg",
        homeScore: 0,
        awayScore: 0,
        penaltyWinner: "AWAY",
      }),
    ).toEqual({ championTeamId: "arg", runnerUpTeamId: "esp" });
  });

  it("empate sem pênaltis registrados ainda → null (aguarda próximo tick)", () => {
    expect(
      resolveFinalWinner({
        homeTeamId: "esp",
        awayTeamId: "arg",
        homeScore: 1,
        awayScore: 1,
        penaltyWinner: null,
      }),
    ).toBeNull();
  });
});

describe("normalizePlayerName — comparação do palpite de artilheiro", () => {
  it("ignora caixa, acentos e espaços nas pontas", () => {
    expect(normalizePlayerName("  Kylian Mbappé  ")).toBe(normalizePlayerName("kylian mbappe"));
    expect(normalizePlayerName("LAMINE YAMAL")).toBe(normalizePlayerName("Lamine Yamal"));
  });

  it("nomes diferentes não colidem", () => {
    expect(normalizePlayerName("Mbappé")).not.toBe(normalizePlayerName("Messi"));
  });
});
