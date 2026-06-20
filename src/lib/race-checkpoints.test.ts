import { describe, it, expect } from "vitest";
import {
  buildRoundCheckpoints,
  buildDayCheckpoints,
  buildGameCheckpoints,
  buildCheckpoints,
} from "./race-checkpoints";
import type { RaceMatch } from "@/server/services/race";

function match(p: Partial<RaceMatch> & { matchId: string }): RaceMatch {
  return {
    matchday: null,
    stage: "GROUP",
    kickoffAt: "2026-06-11T18:00:00.000Z",
    homeCode: "BRA",
    awayCode: "CRO",
    points: {},
    ...p,
  };
}

// 2 jogos na rodada 1 (mesmo dia), 1 na rodada 2 (outro dia), 1 nas oitavas.
const matches: RaceMatch[] = [
  match({ matchId: "m1", matchday: 1, kickoffAt: "2026-06-11T18:00:00.000Z", homeCode: "BRA", awayCode: "CRO" }),
  match({ matchId: "m2", matchday: 1, kickoffAt: "2026-06-11T21:00:00.000Z", homeCode: "ARG", awayCode: "MEX" }),
  match({ matchId: "m3", matchday: 2, kickoffAt: "2026-06-15T18:00:00.000Z", homeCode: "BRA", awayCode: "MEX" }),
  match({ matchId: "m4", stage: "R16", kickoffAt: "2026-07-01T18:00:00.000Z", homeCode: "FRA", awayCode: "ENG" }),
];

describe("buildRoundCheckpoints", () => {
  it("um checkpoint por rodada/fase, cutoff no último jogo da rodada", () => {
    const cps = buildRoundCheckpoints(matches);
    expect(cps.map((c) => c.key)).toEqual(["g1", "g2", "R16"]);
    expect(cps.map((c) => c.cutoff)).toEqual([1, 2, 3]);
    expect(cps[0].label).toBe("Rodada 1");
  });
});

describe("buildDayCheckpoints", () => {
  it("um checkpoint por dia, cutoff no último jogo do dia", () => {
    const cps = buildDayCheckpoints(matches);
    // 3 dias distintos (11/06, 15/06, 01/07)
    expect(cps).toHaveLength(3);
    expect(cps.map((c) => c.cutoff)).toEqual([1, 2, 3]);
  });
});

describe("buildGameCheckpoints", () => {
  it("um checkpoint por jogo, em ordem, com rótulo do confronto", () => {
    const cps = buildGameCheckpoints(matches);
    expect(cps.map((c) => c.cutoff)).toEqual([0, 1, 2, 3]);
    expect(cps.map((c) => c.label)).toEqual([
      "BRA × CRO",
      "ARG × MEX",
      "BRA × MEX",
      "FRA × ENG",
    ]);
    expect(cps.map((c) => c.key)).toEqual(["m1", "m2", "m3", "m4"]);
  });

  it("lista vazia → sem checkpoints", () => {
    expect(buildGameCheckpoints([])).toEqual([]);
  });
});

describe("buildCheckpoints (dispatcher)", () => {
  it("roteia por modo", () => {
    expect(buildCheckpoints("round", matches)).toEqual(buildRoundCheckpoints(matches));
    expect(buildCheckpoints("day", matches)).toEqual(buildDayCheckpoints(matches));
    expect(buildCheckpoints("game", matches)).toEqual(buildGameCheckpoints(matches));
  });
});
