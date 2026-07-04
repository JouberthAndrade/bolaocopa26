import { describe, it, expect } from "vitest";
import {
  manualResultsBodySchema,
  manualResultSchema,
  manualResultUpdateData,
} from "./manual-result";

describe("manualResultSchema", () => {
  it("aceita identificação por externalId", () => {
    const r = manualResultSchema.safeParse({ externalId: "537327", homeScore: 2, awayScore: 0 });
    expect(r.success).toBe(true);
  });

  it("aceita identificação por par de códigos ISO", () => {
    const r = manualResultSchema.safeParse({ homeCode: "mx", awayCode: "za", homeScore: 1, awayScore: 1 });
    expect(r.success).toBe(true);
  });

  it("rejeita quando não há nem externalId nem o par de códigos", () => {
    const r = manualResultSchema.safeParse({ homeCode: "mx", homeScore: 1, awayScore: 0 });
    expect(r.success).toBe(false);
  });

  it("rejeita placar negativo", () => {
    const r = manualResultSchema.safeParse({ externalId: "1", homeScore: -1, awayScore: 0 });
    expect(r.success).toBe(false);
  });

  it("aceita penaltyWinner opcional", () => {
    const r = manualResultSchema.safeParse({
      externalId: "1",
      homeScore: 1,
      awayScore: 1,
      penaltyWinner: "HOME",
    });
    expect(r.success).toBe(true);
  });

  it("rejeita penaltyWinner inválido", () => {
    const r = manualResultSchema.safeParse({
      externalId: "1",
      homeScore: 1,
      awayScore: 1,
      penaltyWinner: "DRAW",
    });
    expect(r.success).toBe(false);
  });
});

describe("manualResultUpdateData — payload de escrita do resultado manual", () => {
  it("com penaltyWinner → grava o vencedor dos pênaltis", () => {
    const d = manualResultUpdateData({ externalId: "1", homeScore: 1, awayScore: 1, penaltyWinner: "AWAY" });
    expect(d).toEqual({
      homeScore: 1,
      awayScore: 1,
      status: "FINISHED",
      scored: false,
      resultConfirmed: true,
      penaltyWinner: "AWAY",
    });
  });

  it("sem penaltyWinner → NÃO toca no campo (preserva o capturado pelo sync)", () => {
    const d = manualResultUpdateData({ externalId: "1", homeScore: 1, awayScore: 1 });
    expect(d).not.toHaveProperty("penaltyWinner");
    expect(d).toMatchObject({ homeScore: 1, awayScore: 1, scored: false, resultConfirmed: true });
  });
});

describe("manualResultsBodySchema — normaliza para array", () => {
  it("objeto solto vira lista de 1", () => {
    const r = manualResultsBodySchema.parse({ externalId: "537327", homeScore: 2, awayScore: 0 });
    expect(r).toHaveLength(1);
    expect(r[0].externalId).toBe("537327");
  });

  it("{ results: [...] } passa direto", () => {
    const r = manualResultsBodySchema.parse({
      results: [
        { externalId: "1", homeScore: 1, awayScore: 0 },
        { homeCode: "br", awayCode: "ar", homeScore: 2, awayScore: 2 },
      ],
    });
    expect(r).toHaveLength(2);
    expect(r[1].homeCode).toBe("br");
  });
});
