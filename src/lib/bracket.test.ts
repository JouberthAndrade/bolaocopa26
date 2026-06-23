import { describe, it, expect } from "vitest";
import { resolveSlot, type BracketSlot } from "./bracket";
import type { TeamStanding } from "./group";

function standing(overrides: Partial<TeamStanding> & { teamId: string; name: string; countryCode: string }): TeamStanding {
  return {
    played: 3, won: 1, drawn: 1, lost: 1,
    goalsFor: 3, goalsAgainst: 3, goalDiff: 0, points: 4, position: 3,
    ...overrides,
  };
}

const standings = new Map<string, TeamStanding[]>([
  ["A", [
    standing({ teamId: "MEX", name: "México",      countryCode: "MX", position: 1, points: 7 }),
    standing({ teamId: "USA", name: "EUA",          countryCode: "US", position: 2, points: 5 }),
    standing({ teamId: "CAN", name: "Canadá",       countryCode: "CA", position: 3, points: 3 }),
    standing({ teamId: "HON", name: "Honduras",     countryCode: "HN", position: 4, points: 0 }),
  ]],
  ["B", [
    standing({ teamId: "BRA", name: "Brasil",       countryCode: "BR", position: 1, points: 9 }),
    standing({ teamId: "ARG", name: "Argentina",    countryCode: "AR", position: 2, points: 6 }),
    standing({ teamId: "URU", name: "Uruguai",      countryCode: "UY", position: 3, points: 2 }),
    standing({ teamId: "PAR", name: "Paraguai",     countryCode: "PY", position: 4, points: 0 }),
  ]],
]);

// Por padrão, A e B já terminaram (posições finais confiáveis).
const completeAB = new Set(["A", "B"]);
const none = new Set<string>();

describe("resolveSlot", () => {
  it("group_1 resolve para o 1° quando o grupo terminou", () => {
    const slot: BracketSlot = { kind: "group_1", group: "A", label: "1°A" };
    const r = resolveSlot(slot, standings, completeAB);
    expect(r.label).toBe("1°A");
    expect(r.team?.name).toBe("México");
    expect(r.team?.countryCode).toBe("MX");
  });

  it("group_2 resolve para o 2° quando o grupo terminou", () => {
    const slot: BracketSlot = { kind: "group_2", group: "B", label: "2°B" };
    const r = resolveSlot(slot, standings, completeAB);
    expect(r.team?.name).toBe("Argentina");
  });

  it("group_1 NÃO resolve enquanto o grupo não terminou (mostra rótulo)", () => {
    const slot: BracketSlot = { kind: "group_1", group: "A", label: "1°A" };
    const r = resolveSlot(slot, standings, none);
    expect(r.team).toBeNull();
    expect(r.label).toBe("1°A");
  });

  it("grupo sem dados retorna null mesmo marcado como completo", () => {
    const slot: BracketSlot = { kind: "group_1", group: "Z", label: "1°Z" };
    const r = resolveSlot(slot, standings, new Set(["Z"]));
    expect(r.team).toBeNull();
    expect(r.label).toBe("1°Z");
  });

  it("best_3 nunca resolve em memória — sempre rótulo (estilo ESPN)", () => {
    const slot: BracketSlot = { kind: "best_3", groups: ["A", "B"], label: "3°AB" };
    const r = resolveSlot(slot, standings, completeAB);
    expect(r.team).toBeNull();
    expect(r.label).toBe("3°AB");
  });

  it("winner_r32 sempre retorna null com label preservado", () => {
    const slot: BracketSlot = { kind: "winner_r32", n: 73, label: "Venc. 2ª fase 1" };
    const r = resolveSlot(slot, standings, completeAB);
    expect(r.team).toBeNull();
    expect(r.label).toBe("Venc. 2ª fase 1");
  });

  it("winner_sf sempre retorna null com label preservado", () => {
    const slot: BracketSlot = { kind: "winner_sf", n: 101, label: "Venc. semifinal 1" };
    const r = resolveSlot(slot, standings, completeAB);
    expect(r.team).toBeNull();
    expect(r.label).toBe("Venc. semifinal 1");
  });

  it("loser_sf sempre retorna null com label preservado", () => {
    const slot: BracketSlot = { kind: "loser_sf", n: 102, label: "Perd. semifinal 2" };
    const r = resolveSlot(slot, standings, completeAB);
    expect(r.team).toBeNull();
    expect(r.label).toBe("Perd. semifinal 2");
  });
});
