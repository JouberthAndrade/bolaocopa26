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
  ["C", [
    standing({ teamId: "GER", name: "Alemanha",     countryCode: "DE", position: 1, points: 7 }),
    standing({ teamId: "ESP", name: "Espanha",      countryCode: "ES", position: 2, points: 5 }),
    standing({ teamId: "ITA", name: "Itália",       countryCode: "IT", position: 3, points: 3 }),
    standing({ teamId: "SUI", name: "Suíça",        countryCode: "CH", position: 4, points: 1 }),
  ]],
]);

describe("resolveSlot", () => {
  it("group_1 retorna o 1° do grupo", () => {
    const slot: BracketSlot = { kind: "group_1", group: "A", label: "1°A" };
    const r = resolveSlot(slot, standings);
    expect(r.label).toBe("1°A");
    expect(r.team?.name).toBe("México");
    expect(r.team?.countryCode).toBe("MX");
  });

  it("group_2 retorna o 2° do grupo", () => {
    const slot: BracketSlot = { kind: "group_2", group: "B", label: "2°B" };
    const r = resolveSlot(slot, standings);
    expect(r.team?.name).toBe("Argentina");
  });

  it("grupo sem dados retorna null", () => {
    const slot: BracketSlot = { kind: "group_1", group: "Z", label: "1°Z" };
    const r = resolveSlot(slot, standings);
    expect(r.team).toBeNull();
  });

  it("best_3 retorna o melhor 3° entre os grupos indicados", () => {
    // Grupo B 3° tem 2pts, Grupo C 3° tem 3pts → C ganha
    const slot: BracketSlot = { kind: "best_3", groups: ["B", "C"], label: "3°BC" };
    const r = resolveSlot(slot, standings);
    expect(r.team?.name).toBe("Itália"); // ITA tem 3pts vs URU 2pts
  });

  it("best_3 retorna null quando nenhum grupo tem 3° colocado", () => {
    const slot: BracketSlot = { kind: "best_3", groups: ["Z"], label: "3°Z" };
    const r = resolveSlot(slot, standings);
    expect(r.team).toBeNull();
  });

  it("winner_r32 sempre retorna null (não resolvível em memória)", () => {
    const slot: BracketSlot = { kind: "winner_r32", n: 1, label: "Venc. R32-1" };
    const r = resolveSlot(slot, standings);
    expect(r.team).toBeNull();
    expect(r.label).toBe("Venc. R32-1");
  });

  it("winner_sf sempre retorna null (não resolvível em memória)", () => {
    const slot: BracketSlot = { kind: "winner_sf", n: 1, label: "Venc. Semif. 1" };
    const r = resolveSlot(slot, standings);
    expect(r.team).toBeNull();
    expect(r.label).toBe("Venc. Semif. 1");
  });

  it("loser_sf sempre retorna null com label preservado", () => {
    const slot: BracketSlot = { kind: "loser_sf", n: 1, label: "Perd. Semif. 1" };
    const r = resolveSlot(slot, standings);
    expect(r.team).toBeNull();
    expect(r.label).toBe("Perd. Semif. 1");
  });

  it("best_3 desempata por saldo de gols quando pontos são iguais", () => {
    // Dois 3° colocados com mesmos pontos, mas saldos de gols diferentes:
    // Grupo D 3° → 3pts, GD = -1, GF = 2
    // Grupo E 3° → 3pts, GD = +2, GF = 4  ← deve ganhar pelo saldo
    const tieStandings = new Map<string, TeamStanding[]>([
      ["D", [
        standing({ teamId: "D1", name: "D-1°", countryCode: "DE", position: 1, points: 9 }),
        standing({ teamId: "D2", name: "D-2°", countryCode: "FR", position: 2, points: 6 }),
        standing({ teamId: "D3", name: "D-3°", countryCode: "PT", position: 3, points: 3, goalDiff: -1, goalsFor: 2, goalsAgainst: 3 }),
        standing({ teamId: "D4", name: "D-4°", countryCode: "NL", position: 4, points: 0 }),
      ]],
      ["E", [
        standing({ teamId: "E1", name: "E-1°", countryCode: "ES", position: 1, points: 9 }),
        standing({ teamId: "E2", name: "E-2°", countryCode: "IT", position: 2, points: 6 }),
        standing({ teamId: "E3", name: "E-melhor3", countryCode: "BR", position: 3, points: 3, goalDiff: 2, goalsFor: 4, goalsAgainst: 2 }),
        standing({ teamId: "E4", name: "E-4°", countryCode: "AR", position: 4, points: 0 }),
      ]],
    ]);
    const slot: BracketSlot = { kind: "best_3", groups: ["D", "E"], label: "3°DE" };
    const r = resolveSlot(slot, tieStandings);
    // E-melhor3 tem GD +2 vs D-3° GD -1 → E-melhor3 vence o desempate
    expect(r.team?.name).toBe("E-melhor3");
  });
});
