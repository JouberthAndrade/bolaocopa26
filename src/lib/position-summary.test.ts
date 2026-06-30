import { describe, it, expect } from "vitest";
import { derivePositionSummary } from "./position-summary";
import type { RankingRow } from "./live-ranking";

function row(p: Partial<RankingRow> & { userId: string; position: number; totalPoints: number }): RankingRow {
  return {
    name: p.userId,
    image: null,
    consolidatedPoints: p.totalPoints,
    exactHits: 0,
    hits: 0,
    misses: 0,
    livePoints: 0,
    isLive: false,
    ...p,
  };
}

const rows: RankingRow[] = [
  row({ userId: "a", position: 1, totalPoints: 30, name: "Ana" }),
  row({ userId: "b", position: 2, totalPoints: 20, name: "Bia" }),
  row({ userId: "c", position: 3, totalPoints: 10, name: "Caio" }),
  row({ userId: "d", position: 4, totalPoints: 5, name: "Davi" }),
];

describe("derivePositionSummary", () => {
  it("retorna posição e pontos do usuário", () => {
    const s = derivePositionSummary(rows, "c");
    expect(s.me?.position).toBe(3);
    expect(s.me?.totalPoints).toBe(10);
  });

  it("top3 traz os três primeiros em ordem", () => {
    const s = derivePositionSummary(rows, "c");
    expect(s.top3.map((r) => r.userId)).toEqual(["a", "b", "c"]);
  });

  it("total reflete a quantidade de participantes", () => {
    expect(derivePositionSummary(rows, "a").total).toBe(4);
  });

  it("usuário fora do ranking → me = null", () => {
    const s = derivePositionSummary(rows, "z");
    expect(s.me).toBeNull();
  });

  it("ranking vazio → me null, top3 vazio, total 0", () => {
    const s = derivePositionSummary([], "a");
    expect(s.me).toBeNull();
    expect(s.top3).toEqual([]);
    expect(s.total).toBe(0);
  });
});
