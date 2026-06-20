import { describe, it, expect } from "vitest";
import {
  sumLivePoints,
  mergeLiveRanking,
  type LiveMatchBets,
  type RankingBase,
} from "./live-ranking";
import type { ResultScoringRule } from "./bet-result";

const rule: ResultScoringRule = {
  pointsExactScore: 1,
  pointsCorrectResult: 2,
  pointsCorrectDraw: 2,
};

describe("sumLivePoints", () => {
  it("soma pontos provisórios dos jogos ao vivo por participante", () => {
    // Jogo 1 ao vivo 2 x 0; Jogo 2 ao vivo 1 x 1.
    const live: LiveMatchBets[] = [
      {
        home: 2,
        away: 0,
        bets: [
          { userId: "ana", homeGuess: 2, awayGuess: 0 }, // exato → 3
          { userId: "bruno", homeGuess: 1, awayGuess: 0 }, // vencedor → 2
          { userId: "carla", homeGuess: 0, awayGuess: 1 }, // errou → 0
        ],
      },
      {
        home: 1,
        away: 1,
        bets: [
          { userId: "ana", homeGuess: 0, awayGuess: 0 }, // acertou empate → 2
          { userId: "bruno", homeGuess: 2, awayGuess: 1 }, // errou → 0
        ],
      },
    ];
    const map = sumLivePoints(live, rule);
    expect(map.get("ana")).toBe(5); // 3 + 2
    expect(map.get("bruno")).toBe(2); // 2 + 0
    expect(map.has("carla")).toBe(false); // 0 não entra no mapa
  });

  it("sem jogos ao vivo → mapa vazio", () => {
    expect(sumLivePoints([], rule).size).toBe(0);
  });
});

describe("mergeLiveRanking", () => {
  const base: RankingBase[] = [
    { userId: "ana", name: "Ana", image: null, consolidatedPoints: 10, exactHits: 1, hits: 3, misses: 1 },
    { userId: "bruno", name: "Bruno", image: null, consolidatedPoints: 12, exactHits: 2, hits: 4, misses: 0 },
    { userId: "carla", name: "Carla", image: null, consolidatedPoints: 8, exactHits: 0, hits: 2, misses: 2 },
  ];

  it("soma livePoints ao consolidado e reordena pelo total", () => {
    // Ana ganha +5 ao vivo → 15, ultrapassa Bruno (12).
    const live = new Map([["ana", 5]]);
    const rows = mergeLiveRanking(base, live);
    expect(rows.map((r) => r.userId)).toEqual(["ana", "bruno", "carla"]);
    const ana = rows[0];
    expect(ana.consolidatedPoints).toBe(10);
    expect(ana.livePoints).toBe(5);
    expect(ana.totalPoints).toBe(15);
    expect(ana.isLive).toBe(true);
    expect(ana.position).toBe(1);
  });

  it("sem overlay ao vivo → ordem pelo consolidado e isLive falso", () => {
    const rows = mergeLiveRanking(base, new Map());
    expect(rows.map((r) => r.userId)).toEqual(["bruno", "ana", "carla"]);
    expect(rows.every((r) => r.isLive === false && r.livePoints === 0)).toBe(true);
    expect(rows.map((r) => r.position)).toEqual([1, 2, 3]);
  });

  it("preserva contagens consolidadas (hits/misses não mudam ao vivo)", () => {
    const rows = mergeLiveRanking(base, new Map([["carla", 4]]));
    const carla = rows.find((r) => r.userId === "carla")!;
    expect(carla.hits).toBe(2);
    expect(carla.misses).toBe(2);
    expect(carla.totalPoints).toBe(12);
  });

  it("desempata total igual pelo maior consolidado", () => {
    // Carla 8 + 4 = 12 empata com Bruno 12 (sem ao vivo).
    // Bruno tem consolidado maior → fica à frente.
    const rows = mergeLiveRanking(base, new Map([["carla", 4]]));
    const ids = rows.map((r) => r.userId);
    expect(ids.indexOf("bruno")).toBeLessThan(ids.indexOf("carla"));
  });
});
