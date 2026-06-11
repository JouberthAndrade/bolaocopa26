import { describe, it, expect } from "vitest";
import { manualResultsBodySchema, manualResultSchema } from "./manual-result";

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
