import { describe, it, expect } from "vitest";
import { mapPenaltyWinner, resolveMatchScore } from "./football-score";

describe("mapPenaltyWinner", () => {
  it("shootout com mandante vencedor → HOME", () => {
    expect(mapPenaltyWinner({ winner: "HOME_TEAM", duration: "PENALTY_SHOOTOUT" })).toBe("HOME");
  });

  it("shootout com visitante vencedor → AWAY", () => {
    expect(mapPenaltyWinner({ winner: "AWAY_TEAM", duration: "PENALTY_SHOOTOUT" })).toBe("AWAY");
  });

  it("jogo decidido no tempo normal → null", () => {
    expect(mapPenaltyWinner({ winner: "HOME_TEAM", duration: "REGULAR" })).toBe(null);
  });

  it("prorrogação sem pênaltis → null", () => {
    expect(mapPenaltyWinner({ winner: "AWAY_TEAM", duration: "EXTRA_TIME" })).toBe(null);
  });

  it("campos ausentes → null", () => {
    expect(mapPenaltyWinner({})).toBe(null);
  });
});

describe("resolveMatchScore", () => {
  it("tempo normal → usa fullTime", () => {
    expect(
      resolveMatchScore({
        duration: "REGULAR",
        fullTime: { home: 2, away: 0 },
        regularTime: { home: 2, away: 0 },
      }),
    ).toEqual({ home: 2, away: 0 });
  });

  it("prorrogação → usa fullTime (inclui gols da prorrogação)", () => {
    expect(
      resolveMatchScore({
        duration: "EXTRA_TIME",
        fullTime: { home: 2, away: 1 },
        regularTime: { home: 1, away: 1 },
      }),
    ).toEqual({ home: 2, away: 1 });
  });

  it("pênaltis → ignora o shootout e usa regularTime (Países Baixos x Marrocos)", () => {
    expect(
      resolveMatchScore({
        winner: "AWAY_TEAM",
        duration: "PENALTY_SHOOTOUT",
        fullTime: { home: 3, away: 4 },
        regularTime: { home: 1, away: 1 },
      }),
    ).toEqual({ home: 1, away: 1 });
  });

  it("pênaltis sem regularTime → cai para fullTime (defensivo)", () => {
    expect(
      resolveMatchScore({
        duration: "PENALTY_SHOOTOUT",
        fullTime: { home: 3, away: 4 },
      }),
    ).toEqual({ home: 3, away: 4 });
  });

  it("placar ainda não publicado → null", () => {
    expect(resolveMatchScore({ duration: "REGULAR", fullTime: { home: null, away: null } })).toEqual(
      { home: null, away: null },
    );
  });
});
