import { describe, it, expect } from "vitest";
import { decideResultWrite, type StoredResult } from "./result-confirmation";

const stored = (over: Partial<StoredResult> = {}): StoredResult => ({
  status: "SCHEDULED",
  homeScore: null,
  awayScore: null,
  resultConfirmed: false,
  scored: false,
  ...over,
});

describe("decideResultWrite — double check de resultado", () => {
  it("jogo novo (sem registro) → grava, não confirma", () => {
    const d = decideResultWrite(null, { status: "FINISHED", homeScore: 1, awayScore: 2 });
    expect(d).toEqual({
      locked: false,
      status: "FINISHED",
      homeScore: 1,
      awayScore: 2,
      resultConfirmed: false,
    });
  });

  it("primeira vez FINISHED (estava LIVE) → grava placar, ainda NÃO confirma", () => {
    const d = decideResultWrite(stored({ status: "LIVE" }), {
      status: "FINISHED",
      homeScore: 1,
      awayScore: 2,
    });
    expect(d).toMatchObject({ locked: false, resultConfirmed: false, homeScore: 1, awayScore: 2 });
  });

  it("segunda observação FINISHED com MESMO placar → confirma", () => {
    const d = decideResultWrite(stored({ status: "FINISHED", homeScore: 2, awayScore: 0 }), {
      status: "FINISHED",
      homeScore: 2,
      awayScore: 0,
    });
    expect(d).toMatchObject({ locked: false, resultConfirmed: true });
  });

  it("VAR: segunda observação com placar DIFERENTE → atualiza e NÃO confirma", () => {
    // antes: 1x2 (gol do Irã); agora a API corrigiu para 1x1
    const d = decideResultWrite(stored({ status: "FINISHED", homeScore: 1, awayScore: 2 }), {
      status: "FINISHED",
      homeScore: 1,
      awayScore: 1,
    });
    expect(d).toMatchObject({
      locked: false,
      resultConfirmed: false,
      homeScore: 1,
      awayScore: 1,
    });
  });

  it("VAR após já pontuado → re-arma scoring (scored=false)", () => {
    const d = decideResultWrite(
      stored({ status: "FINISHED", homeScore: 1, awayScore: 2, scored: true }),
      { status: "FINISHED", homeScore: 1, awayScore: 1 },
    );
    expect(d).toMatchObject({ locked: false, resultConfirmed: false, scored: false });
  });

  it("já confirmado → locked (nunca sobrescreve)", () => {
    const d = decideResultWrite(
      stored({ status: "FINISHED", homeScore: 1, awayScore: 1, resultConfirmed: true, scored: true }),
      { status: "FINISHED", homeScore: 9, awayScore: 9 },
    );
    expect(d).toEqual({ locked: true });
  });

  it("FINISHED sem placar publicado (null) → não confirma", () => {
    const d = decideResultWrite(stored({ status: "FINISHED", homeScore: null, awayScore: null }), {
      status: "FINISHED",
      homeScore: null,
      awayScore: null,
    });
    expect(d).toMatchObject({ locked: false, resultConfirmed: false });
  });

  it("placar idêntico já pontuado mas não confirmado → confirma sem re-armar", () => {
    // backfill/legado: scored=true porém resultConfirmed=false e placar já correto
    const d = decideResultWrite(
      stored({ status: "FINISHED", homeScore: 2, awayScore: 1, scored: true }),
      { status: "FINISHED", homeScore: 2, awayScore: 1 },
    );
    expect(d).toMatchObject({ locked: false, resultConfirmed: true });
    expect(d).not.toHaveProperty("scored");
  });
});
