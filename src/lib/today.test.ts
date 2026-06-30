import { describe, it, expect } from "vitest";
import { saoPauloDayRange } from "./today";

describe("saoPauloDayRange", () => {
  it("12:00 de SP → dia começa 03:00Z e termina 02:59:59.999Z do dia seguinte", () => {
    const { start, end } = saoPauloDayRange(new Date("2026-06-30T15:00:00Z")); // 12:00 SP
    expect(start.toISOString()).toBe("2026-06-30T03:00:00.000Z");
    expect(end.toISOString()).toBe("2026-07-01T02:59:59.999Z");
  });

  it("instante ainda 'ontem' em SP usa o dia local de SP", () => {
    // 02:00Z de 30/06 = 23:00 SP de 29/06 → dia 29/06
    const { start } = saoPauloDayRange(new Date("2026-06-30T02:00:00Z"));
    expect(start.toISOString()).toBe("2026-06-29T03:00:00.000Z");
  });

  it("jogo às 17:00 SP cai dentro do intervalo do dia", () => {
    const { start, end } = saoPauloDayRange(new Date("2026-06-30T15:00:00Z"));
    const kickoff = new Date("2026-06-30T20:00:00Z"); // 17:00 SP
    expect(kickoff >= start && kickoff <= end).toBe(true);
  });

  it("jogo às 02:00 SP do dia seguinte fica fora do intervalo", () => {
    const { start, end } = saoPauloDayRange(new Date("2026-06-30T15:00:00Z"));
    const kickoff = new Date("2026-07-01T05:00:00Z"); // 02:00 SP do dia 01/07
    expect(kickoff >= start && kickoff <= end).toBe(false);
  });
});
