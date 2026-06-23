import { describe, it, expect } from "vitest";
import { computeGroupStandings } from "./group";

const T = [
  { id: "BRA", name: "Brasil",    countryCode: "BR" },
  { id: "ARG", name: "Argentina", countryCode: "AR" },
  { id: "URU", name: "Uruguai",   countryCode: "UY" },
  { id: "PAR", name: "Paraguai",  countryCode: "PY" },
];

function m(h: string, a: string, hg: number, ag: number) {
  return { homeTeamId: h, awayTeamId: a, homeScore: hg, awayScore: ag };
}

describe("computeGroupStandings", () => {
  it("retorna 4 times com posição 1–4 e stats zerados sem partidas", () => {
    const s = computeGroupStandings(T, []);
    expect(s).toHaveLength(4);
    expect(s.map((x) => x.position)).toEqual([1, 2, 3, 4]);
    s.forEach((x) => {
      expect(x.played).toBe(0);
      expect(x.points).toBe(0);
    });
  });

  it("ordena por pontos: vencedor com 3pts aparece em 1°", () => {
    const s = computeGroupStandings(T, [m("BRA", "ARG", 2, 0)]);
    expect(s[0].teamId).toBe("BRA");
    expect(s[0].points).toBe(3);
    expect(s[0].played).toBe(1);
    expect(s[0].won).toBe(1);
    expect(s[1].teamId).toBe("ARG");
    expect(s[1].lost).toBe(1);
  });

  it("desempate por saldo de gols", () => {
    const s = computeGroupStandings(T, [
      m("BRA", "URU", 3, 1), // BRA 3pts GD+2
      m("ARG", "PAR", 2, 1), // ARG 3pts GD+1
    ]);
    expect(s[0].teamId).toBe("BRA");
    expect(s[1].teamId).toBe("ARG");
  });

  it("desempate por gols marcados quando SG igual", () => {
    const s = computeGroupStandings(T, [
      m("BRA", "URU", 2, 1), // BRA 3pts GD+1 GF=2
      m("ARG", "PAR", 3, 2), // ARG 3pts GD+1 GF=3
    ]);
    expect(s[0].teamId).toBe("ARG"); // ARG tem mais gols
    expect(s[1].teamId).toBe("BRA");
  });

  it("aplica confronto direto quando pts + SG + GF são iguais", () => {
    // BRA e ARG: 4pts, GD=0, GF=2 — mas BRA ganhou o H2H
    const s = computeGroupStandings(T, [
      m("BRA", "ARG", 1, 0), // BRA H2H win
      m("URU", "BRA", 1, 0), // BRA perde → saldo BRA: GF=1+0=1... não. Veja abaixo:
      // BRA: W(ARG 1-0) + L(URU 0-1) + D(PAR 1-1) → 4pts GF=2 GA=2 GD=0
      // ARG: L(BRA 0-1) + W(URU 2-1) + D(PAR 0-0) → 4pts GF=2 GA=2 GD=0
      m("BRA", "PAR", 1, 1),
      m("ARG", "URU", 2, 1),
      m("ARG", "PAR", 0, 0),
      m("URU", "PAR", 0, 1),
    ]);
    const braPos = s.find((x) => x.teamId === "BRA")!.position;
    const argPos = s.find((x) => x.teamId === "ARG")!.position;
    expect(braPos).toBeLessThan(argPos); // BRA ganha H2H vs ARG
  });

  it("empate circular no H2H mantém ordem estável", () => {
    const three = [
      { id: "A", name: "A", countryCode: "XX" },
      { id: "B", name: "B", countryCode: "YY" },
      { id: "C", name: "C", countryCode: "ZZ" },
    ];
    // A→B, B→C, C→A (todos 1V1D): todos idênticos — sort estável
    const s = computeGroupStandings(three, [
      m("A", "B", 2, 1),
      m("B", "C", 2, 1),
      m("C", "A", 2, 1),
    ]);
    expect(s.map((x) => x.teamId)).toEqual(["A", "B", "C"]);
  });

  it("ignora partidas sem placar definido", () => {
    const matches = [
      { homeTeamId: "BRA", awayTeamId: "ARG", homeScore: null, awayScore: null },
    ];
    const s = computeGroupStandings(T, matches);
    s.forEach((x) => expect(x.played).toBe(0));
  });
});
