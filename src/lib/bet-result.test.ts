import { describe, it, expect } from "vitest";
import { classifyBet } from "./bet-result";

const finished = (home: number, away: number) => ({ home, away, finished: true });

describe("classifyBet", () => {
  it("placar exato (vitória) → EXACT", () => {
    const r = classifyBet({ home: 2, away: 1 }, finished(2, 1));
    expect(r.kind).toBe("EXACT");
    expect(r.isDraw).toBe(false);
    expect(r.label).toBe("Acertou o placar exato");
  });

  it("placar exato (empate) → EXACT com isDraw", () => {
    const r = classifyBet({ home: 1, away: 1 }, finished(1, 1));
    expect(r.kind).toBe("EXACT");
    expect(r.isDraw).toBe(true);
  });

  it("acertou só o vencedor → RESULT", () => {
    const r = classifyBet({ home: 1, away: 0 }, finished(2, 1));
    expect(r.kind).toBe("RESULT");
    expect(r.isDraw).toBe(false);
    expect(r.label).toBe("Acertou o vencedor");
  });

  it("acertou o empate sem placar exato → RESULT/empate", () => {
    const r = classifyBet({ home: 0, away: 0 }, finished(2, 2));
    expect(r.kind).toBe("RESULT");
    expect(r.isDraw).toBe(true);
    expect(r.label).toBe("Acertou o empate");
  });

  it("errou o vencedor → MISS", () => {
    const r = classifyBet({ home: 1, away: 1 }, finished(2, 1));
    expect(r.kind).toBe("MISS");
    expect(r.label).toBe("Não pontuou");
  });

  it("previu empate mas deu vitória → MISS", () => {
    expect(classifyBet({ home: 1, away: 1 }, finished(2, 0)).kind).toBe("MISS");
  });

  it("jogo não finalizado → PENDING", () => {
    expect(classifyBet({ home: 1, away: 0 }, { home: null, away: null, finished: false }).kind).toBe("PENDING");
  });

  it("finalizado mas sem placar → PENDING", () => {
    expect(classifyBet({ home: 1, away: 0 }, { home: null, away: null, finished: true }).kind).toBe("PENDING");
  });

  it("sem palpite → PENDING", () => {
    expect(classifyBet(null, finished(2, 1)).kind).toBe("PENDING");
  });
});
