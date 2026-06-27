import { describe, it, expect } from "vitest";
import { isBetClosed } from "./bet-gate";

const NOW = new Date("2026-06-27T18:00:00.000Z");

describe("isBetClosed", () => {
  it("aberto: SCHEDULED e lockAt no futuro", () => {
    expect(
      isBetClosed({ lockAt: new Date("2026-06-27T19:00:00.000Z"), status: "SCHEDULED" }, NOW),
    ).toBe(false);
  });

  it("fechado: lockAt já passou", () => {
    expect(
      isBetClosed({ lockAt: new Date("2026-06-27T17:00:00.000Z"), status: "SCHEDULED" }, NOW),
    ).toBe(true);
  });

  it("fechado: status diferente de SCHEDULED", () => {
    expect(
      isBetClosed({ lockAt: new Date("2026-06-27T19:00:00.000Z"), status: "LIVE" }, NOW),
    ).toBe(true);
  });
});
