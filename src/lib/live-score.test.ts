import { describe, it, expect } from "vitest";
import {
  planLiveScoreUpdates,
  type DbMatchLite,
  type LiveFixture,
} from "./live-score";

// México (mx) x África do Sul (za) — jogo do exemplo da API-Sports.
const mexVsZa: DbMatchLite = {
  id: "match-mex-za",
  homeCode: "mx",
  awayCode: "za",
  kickoffAt: new Date("2026-06-11T19:00:00.000Z"),
  status: "SCHEDULED",
  homeScore: null,
  awayScore: null,
};

function fixture(over: Partial<LiveFixture> = {}): LiveFixture {
  return {
    fixtureId: 1489369,
    homeName: "Mexico",
    awayName: "South Africa",
    homeGoals: 1,
    awayGoals: 0,
    date: new Date("2026-06-11T19:00:00.000Z"),
    ...over,
  };
}

describe("planLiveScoreUpdates — de-para API-Sports → jogos do banco", () => {
  it("casa por código ISO e atualiza placar (México 1 x 0), promovendo a LIVE", () => {
    const { updates, unmatched } = planLiveScoreUpdates([fixture()], [mexVsZa]);
    expect(unmatched).toHaveLength(0);
    expect(updates).toEqual([
      { matchId: "match-mex-za", homeScore: 1, awayScore: 0, promoteToLive: true },
    ]);
  });

  it("não promove de novo quando o jogo já está LIVE, mas atualiza o placar", () => {
    const live: DbMatchLite = { ...mexVsZa, status: "LIVE", homeScore: 1, awayScore: 0 };
    const { updates } = planLiveScoreUpdates([fixture({ homeGoals: 2 })], [live]);
    expect(updates).toEqual([
      { matchId: "match-mex-za", homeScore: 2, awayScore: 0, promoteToLive: false },
    ]);
  });

  it("não gera update quando placar e status não mudaram", () => {
    const live: DbMatchLite = { ...mexVsZa, status: "LIVE", homeScore: 1, awayScore: 0 };
    const { updates } = planLiveScoreUpdates([fixture()], [live]);
    expect(updates).toHaveLength(0);
  });

  it("trata gols null como 0", () => {
    const { updates } = planLiveScoreUpdates(
      [fixture({ homeGoals: null, awayGoals: null })],
      [mexVsZa],
    );
    expect(updates[0]).toMatchObject({ homeScore: 0, awayScore: 0 });
  });

  it("nunca rebaixa um jogo já FINISHED", () => {
    const finished: DbMatchLite = { ...mexVsZa, status: "FINISHED", homeScore: 1, awayScore: 0 };
    const { updates, unmatched } = planLiveScoreUpdates([fixture({ homeGoals: 2 })], [finished]);
    expect(updates).toHaveLength(0);
    expect(unmatched).toHaveLength(1); // sem candidato vivo → reportado como não casado
  });

  it("seleção fora do de-para vira unmatched", () => {
    const { updates, unmatched } = planLiveScoreUpdates(
      [fixture({ awayName: "Atlantis" })],
      [mexVsZa],
    );
    expect(updates).toHaveLength(0);
    expect(unmatched).toEqual([
      { fixtureId: 1489369, home: "Mexico", away: "Atlantis" },
    ]);
  });

  it("desempata par repetido (grupos vs mata-mata) pelo kickoff mais próximo", () => {
    const groupGame: DbMatchLite = { ...mexVsZa, id: "grupo", kickoffAt: new Date("2026-06-11T19:00:00.000Z") };
    const knockout: DbMatchLite = { ...mexVsZa, id: "mata-mata", kickoffAt: new Date("2026-07-05T19:00:00.000Z") };
    const { updates } = planLiveScoreUpdates([fixture()], [knockout, groupGame]);
    expect(updates).toHaveLength(1);
    expect(updates[0].matchId).toBe("grupo");
  });
});
