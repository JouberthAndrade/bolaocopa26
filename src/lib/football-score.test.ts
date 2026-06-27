import { describe, it, expect } from "vitest";
import { mapPenaltyWinner } from "./football-score";

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
