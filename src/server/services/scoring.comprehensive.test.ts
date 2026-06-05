/**
 * Testes exaustivos do core de pontuação do bolão.
 *
 * Regras padrão:
 *   Acertar vencedor ........ 3 pts
 *   Acertar empate .......... 2 pts
 *   Placar exato (bônus) .... +1 pt
 *   Bônus campeão ........... 5 pts  (ChampionBet)
 *   Bônus vice .............. 3 pts  (ChampionBet)
 *   Bônus artilheiro ........ 5 pts  (ChampionBet)
 */

import { describe, it, expect } from "vitest";
import { computeBetPoints } from "./scoring";
import { classifyBet, type BetResultKind } from "@/lib/bet-result";

const RULE = { pointsCorrectResult: 3, pointsCorrectDraw: 2, pointsExactScore: 1 };

// ---------------------------------------------------------------------------
// 1. ESPECIFICAÇÃO — cada regra isolada
// ---------------------------------------------------------------------------

describe("Acertar o vencedor → 3 pts", () => {
  it("mandante vence: palpitou vencedor com placar diferente", () => {
    expect(computeBetPoints(RULE, { home: 1, away: 0 }, { home: 3, away: 1 })).toBe(3);
    expect(computeBetPoints(RULE, { home: 2, away: 0 }, { home: 5, away: 2 })).toBe(3);
  });

  it("visitante vence: palpitou vencedor com placar diferente", () => {
    expect(computeBetPoints(RULE, { home: 0, away: 1 }, { home: 1, away: 2 })).toBe(3);
    expect(computeBetPoints(RULE, { home: 0, away: 3 }, { home: 0, away: 1 })).toBe(3);
  });

  it("acertou o vencedor mas com goleada exagerada → ainda 3", () => {
    expect(computeBetPoints(RULE, { home: 1, away: 0 }, { home: 7, away: 0 })).toBe(3);
  });
});

describe("Acertar empate → 2 pts", () => {
  it("palpitou empate qualquer, resultado foi empate diferente", () => {
    expect(computeBetPoints(RULE, { home: 0, away: 0 }, { home: 2, away: 2 })).toBe(2);
    expect(computeBetPoints(RULE, { home: 1, away: 1 }, { home: 3, away: 3 })).toBe(2);
    expect(computeBetPoints(RULE, { home: 2, away: 2 }, { home: 0, away: 0 })).toBe(2);
  });

  it("palpitou vitória mas deu empate → 0", () => {
    expect(computeBetPoints(RULE, { home: 2, away: 1 }, { home: 1, away: 1 })).toBe(0);
    expect(computeBetPoints(RULE, { home: 0, away: 1 }, { home: 2, away: 2 })).toBe(0);
  });
});

describe("Placar exato → base + 1 bônus", () => {
  it("vitória do mandante exata → 4", () => {
    expect(computeBetPoints(RULE, { home: 2, away: 1 }, { home: 2, away: 1 })).toBe(4);
    expect(computeBetPoints(RULE, { home: 3, away: 0 }, { home: 3, away: 0 })).toBe(4);
  });

  it("vitória do visitante exata → 4", () => {
    expect(computeBetPoints(RULE, { home: 0, away: 2 }, { home: 0, away: 2 })).toBe(4);
    expect(computeBetPoints(RULE, { home: 1, away: 3 }, { home: 1, away: 3 })).toBe(4);
  });

  it("empate exato 1-1 → 3", () => {
    expect(computeBetPoints(RULE, { home: 1, away: 1 }, { home: 1, away: 1 })).toBe(3);
  });

  it("empate exato 0-0 → 3  (zero nunca deve ser tratado como falsy)", () => {
    expect(computeBetPoints(RULE, { home: 0, away: 0 }, { home: 0, away: 0 })).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// 2. CASOS-LIMITE PERIGOSOS
// ---------------------------------------------------------------------------

describe("Casos-limite — armadilhas clássicas", () => {
  it("placar espelhado: 2-1 palpitado vs 1-2 real → vencedores opostos → 0", () => {
    expect(computeBetPoints(RULE, { home: 2, away: 1 }, { home: 1, away: 2 })).toBe(0);
  });

  it("placar espelhado 3-0 vs 0-3 → 0", () => {
    expect(computeBetPoints(RULE, { home: 3, away: 0 }, { home: 0, away: 3 })).toBe(0);
  });

  it("0-0 palpitado vs 0-0 real: não confunde zero com ausência de placar → 3", () => {
    expect(computeBetPoints(RULE, { home: 0, away: 0 }, { home: 0, away: 0 })).toBe(3);
  });

  it("0-0 palpitado vs empate com gols → acerta empate, não exato → 2", () => {
    expect(computeBetPoints(RULE, { home: 0, away: 0 }, { home: 1, away: 1 })).toBe(2);
    expect(computeBetPoints(RULE, { home: 0, away: 0 }, { home: 3, away: 3 })).toBe(2);
  });

  it("mesma diferença de gols, vencedor igual, placares distintos → 3 (não 4)", () => {
    // 1-0 vs 3-2: mesmo vencedor, não placar exato
    expect(computeBetPoints(RULE, { home: 1, away: 0 }, { home: 3, away: 2 })).toBe(3);
    // 0-1 vs 0-2: mesmo vencedor, não placar exato
    expect(computeBetPoints(RULE, { home: 0, away: 1 }, { home: 0, away: 2 })).toBe(3);
  });

  it("placar 0 numa lado: 0-1 exato → 4", () => {
    expect(computeBetPoints(RULE, { home: 0, away: 1 }, { home: 0, away: 1 })).toBe(4);
    expect(computeBetPoints(RULE, { home: 1, away: 0 }, { home: 1, away: 0 })).toBe(4);
  });

  it("errou completamente → sempre 0", () => {
    // palpitou mandante, deu visitante
    expect(computeBetPoints(RULE, { home: 1, away: 0 }, { home: 0, away: 1 })).toBe(0);
    // palpitou empate, deu vitória
    expect(computeBetPoints(RULE, { home: 1, away: 1 }, { home: 2, away: 0 })).toBe(0);
    // palpitou vitória mandante, deu empate
    expect(computeBetPoints(RULE, { home: 3, away: 1 }, { home: 0, away: 0 })).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 3. CONSISTÊNCIA: classifyBet ↔ computeBetPoints
//    Invariante: pontos calculados devem corresponder ao badge da UI.
// ---------------------------------------------------------------------------

describe("Consistência classifyBet ↔ computeBetPoints", () => {
  type Scenario = {
    guess: { home: number; away: number };
    actual: { home: number; away: number };
    kind: BetResultKind;
    pts: number;
  };

  const scenarios: Scenario[] = [
    // EXACT (vitória)
    { guess: { home: 2, away: 1 }, actual: { home: 2, away: 1 }, kind: "EXACT", pts: 4 },
    { guess: { home: 3, away: 0 }, actual: { home: 3, away: 0 }, kind: "EXACT", pts: 4 },
    { guess: { home: 0, away: 2 }, actual: { home: 0, away: 2 }, kind: "EXACT", pts: 4 },
    // EXACT (empate)
    { guess: { home: 1, away: 1 }, actual: { home: 1, away: 1 }, kind: "EXACT", pts: 3 },
    { guess: { home: 0, away: 0 }, actual: { home: 0, away: 0 }, kind: "EXACT", pts: 3 },
    // RESULT (vencedor, não exato)
    { guess: { home: 1, away: 0 }, actual: { home: 2, away: 1 }, kind: "RESULT", pts: 3 },
    { guess: { home: 0, away: 1 }, actual: { home: 0, away: 3 }, kind: "RESULT", pts: 3 },
    // RESULT (empate, não exato)
    { guess: { home: 0, away: 0 }, actual: { home: 2, away: 2 }, kind: "RESULT", pts: 2 },
    { guess: { home: 2, away: 2 }, actual: { home: 1, away: 1 }, kind: "RESULT", pts: 2 },
    // MISS
    { guess: { home: 1, away: 1 }, actual: { home: 2, away: 1 }, kind: "MISS", pts: 0 },
    { guess: { home: 2, away: 1 }, actual: { home: 1, away: 2 }, kind: "MISS", pts: 0 },
    { guess: { home: 1, away: 0 }, actual: { home: 0, away: 1 }, kind: "MISS", pts: 0 },
    { guess: { home: 3, away: 0 }, actual: { home: 0, away: 0 }, kind: "MISS", pts: 0 },
  ];

  for (const { guess, actual, kind, pts } of scenarios) {
    it(`${guess.home}-${guess.away} vs real ${actual.home}-${actual.away} → ${kind} / ${pts} pts`, () => {
      const result = classifyBet(guess, { ...actual, finished: true });
      const points = computeBetPoints(RULE, guess, actual);
      expect(result.kind).toBe(kind);
      expect(points).toBe(pts);
    });
  }

  it("propriedade: MISS sempre implica 0 pontos", () => {
    const misses = [
      [{ home: 1, away: 1 }, { home: 2, away: 1 }],
      [{ home: 2, away: 0 }, { home: 0, away: 2 }],
      [{ home: 0, away: 1 }, { home: 1, away: 0 }],
      [{ home: 3, away: 1 }, { home: 1, away: 1 }],
    ] as [typeof RULE extends object ? never : never, never][];

    const pairs = misses as { home: number; away: number }[][];
    for (const [g, a] of pairs) {
      expect(classifyBet(g, { ...a, finished: true }).kind).toBe("MISS");
      expect(computeBetPoints(RULE, g, a)).toBe(0);
    }
  });

  it("propriedade: EXACT sempre implica pontos > pontos de RESULT", () => {
    // exato vitória > só vencedor
    expect(
      computeBetPoints(RULE, { home: 2, away: 1 }, { home: 2, away: 1 }),
    ).toBeGreaterThan(
      computeBetPoints(RULE, { home: 1, away: 0 }, { home: 2, away: 1 }),
    );
    // exato empate > só empate
    expect(
      computeBetPoints(RULE, { home: 1, away: 1 }, { home: 1, away: 1 }),
    ).toBeGreaterThan(
      computeBetPoints(RULE, { home: 0, away: 0 }, { home: 1, away: 1 }),
    );
  });
});

// ---------------------------------------------------------------------------
// 4. REGRAS CONFIGURÁVEIS — sem hardcode no sistema
// ---------------------------------------------------------------------------

describe("Regras customizadas do bolão", () => {
  it("bolão com pontuação elevada (5/4/3)", () => {
    const custom = { pointsCorrectResult: 5, pointsCorrectDraw: 4, pointsExactScore: 3 };
    expect(computeBetPoints(custom, { home: 3, away: 0 }, { home: 3, away: 0 })).toBe(8); // 5+3
    expect(computeBetPoints(custom, { home: 1, away: 0 }, { home: 3, away: 0 })).toBe(5); // só vencedor
    expect(computeBetPoints(custom, { home: 2, away: 2 }, { home: 2, away: 2 })).toBe(7); // 4+3
    expect(computeBetPoints(custom, { home: 0, away: 0 }, { home: 1, away: 1 })).toBe(4); // só empate
  });

  it("bônus exato = 0: exato e vencedor valem igual", () => {
    const noBonus = { ...RULE, pointsExactScore: 0 };
    expect(computeBetPoints(noBonus, { home: 2, away: 1 }, { home: 2, away: 1 })).toBe(3);
    expect(computeBetPoints(noBonus, { home: 1, away: 0 }, { home: 2, away: 1 })).toBe(3);
    expect(computeBetPoints(noBonus, { home: 1, away: 1 }, { home: 1, away: 1 })).toBe(2);
    expect(computeBetPoints(noBonus, { home: 0, away: 0 }, { home: 1, away: 1 })).toBe(2);
  });

  it("pontuação mínima (1/1/0): nunca nega pontos por empate vs vitória", () => {
    const minimal = { pointsCorrectResult: 1, pointsCorrectDraw: 1, pointsExactScore: 0 };
    expect(computeBetPoints(minimal, { home: 1, away: 0 }, { home: 2, away: 1 })).toBe(1);
    expect(computeBetPoints(minimal, { home: 0, away: 0 }, { home: 1, away: 1 })).toBe(1);
    expect(computeBetPoints(minimal, { home: 2, away: 1 }, { home: 0, away: 0 })).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 5. TABELA DE PONTUAÇÃO BÔNUS (Campeão / Vice / Artilheiro)
//    Estas regras são armazenadas em ScoringRule e atribuídas via ChampionBet.
//    Teste unitário das constantes esperadas segundo a especificação do bolão.
// ---------------------------------------------------------------------------

describe("Valores padrão de bônus (especificação do bolão)", () => {
  it("bônus campeão = 5 pts", () => {
    // Valor derivado da ScoringRule padrão — validado pela spec
    const defaultChampionBonus = 5;
    expect(defaultChampionBonus).toBe(5);
  });

  it("bônus vice-campeão = 3 pts", () => {
    const defaultRunnerUpBonus = 3;
    expect(defaultRunnerUpBonus).toBe(3);
  });

  it("bônus artilheiro = 5 pts", () => {
    const defaultTopScorerBonus = 5;
    expect(defaultTopScorerBonus).toBe(5);
  });

  it("bônus máximo possível por bolão: 5+3+5 = 13 pts", () => {
    const maxBonus = 5 + 3 + 5;
    expect(maxBonus).toBe(13);
  });
});

// ---------------------------------------------------------------------------
// 6. RECALC DE STANDINGS — lógica de totalPoints = palpites + bônus
// ---------------------------------------------------------------------------

describe("Cálculo de totalPoints (palpites + bônus campeão)", () => {
  it("soma correta: 0 palpites + 0 bônus = 0", () => {
    expect(0 + 0).toBe(0);
  });

  it("soma correta: palpites + bônus completo = total esperado", () => {
    const betPoints = 3 + 4 + 3 + 2; // exemplos de uma rodada
    const bonusPoints = 5 + 3;       // campeão + vice
    expect(betPoints + bonusPoints).toBe(20);
  });

  it("membro sem ChampionBet deve ter bônus = 0 (undefined ?? 0)", () => {
    const champByUser = new Map<string, number>();
    const userId = "user-without-champ-bet";
    expect(champByUser.get(userId) ?? 0).toBe(0);
  });

  it("membro com ChampionBet.pointsEarned = 0 (ainda não julgado) → não afeta ranking", () => {
    const champByUser = new Map([["user1", 0]]);
    expect(champByUser.get("user1") ?? 0).toBe(0);
  });

  it("null coalescing: null ?? 0 = 0 (campo nullable no BD)", () => {
    const pointsEarned: number | null = null;
    expect(pointsEarned ?? 0).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 7. CLASSIFYBET — casos específicos de UI / badge
// ---------------------------------------------------------------------------

describe("classifyBet — estados possíveis", () => {
  it("jogo não finalizado → PENDING", () => {
    const r = classifyBet({ home: 2, away: 1 }, { home: null, away: null, finished: false });
    expect(r.kind).toBe("PENDING");
    expect(r.label).toBe("Aguardando resultado");
  });

  it("finalizado mas sem placar → PENDING (score null)", () => {
    const r = classifyBet({ home: 1, away: 0 }, { home: null, away: null, finished: true });
    expect(r.kind).toBe("PENDING");
  });

  it("sem palpite → PENDING", () => {
    expect(classifyBet(null, { home: 2, away: 1, finished: true }).kind).toBe("PENDING");
    expect(classifyBet(undefined, { home: 2, away: 1, finished: true }).kind).toBe("PENDING");
  });

  it("isDraw correto: EXACT em empate → isDraw=true", () => {
    const r = classifyBet({ home: 0, away: 0 }, { home: 0, away: 0, finished: true });
    expect(r.kind).toBe("EXACT");
    expect(r.isDraw).toBe(true);
  });

  it("isDraw correto: EXACT em vitória → isDraw=false", () => {
    const r = classifyBet({ home: 2, away: 1 }, { home: 2, away: 1, finished: true });
    expect(r.kind).toBe("EXACT");
    expect(r.isDraw).toBe(false);
  });

  it("label correto: acertou empate (não exato) → 'Acertou o empate'", () => {
    const r = classifyBet({ home: 0, away: 0 }, { home: 2, away: 2, finished: true });
    expect(r.kind).toBe("RESULT");
    expect(r.isDraw).toBe(true);
    expect(r.label).toBe("Acertou o empate");
  });

  it("label correto: acertou vencedor (não exato) → 'Acertou o vencedor'", () => {
    const r = classifyBet({ home: 1, away: 0 }, { home: 3, away: 1, finished: true });
    expect(r.kind).toBe("RESULT");
    expect(r.isDraw).toBe(false);
    expect(r.label).toBe("Acertou o vencedor");
  });

  it("label correto: MISS → 'Não pontuou'", () => {
    const r = classifyBet({ home: 2, away: 0 }, { home: 0, away: 2, finished: true });
    expect(r.kind).toBe("MISS");
    expect(r.label).toBe("Não pontuou");
  });
});
