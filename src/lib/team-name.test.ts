import { describe, it, expect } from "vitest";
import { normalizeTeamName, teamNamesMatch, teamCode } from "./team-name";

describe("normalizeTeamName", () => {
  it("ignora acentos e caixa", () => {
    expect(normalizeTeamName("Curaçao")).toBe(normalizeTeamName("Curacao"));
    expect(normalizeTeamName("MÉXICO")).toBe(normalizeTeamName("mexico"));
  });

  it("normaliza '&' e 'and'", () => {
    expect(normalizeTeamName("Bosnia & Herzegovina")).toBe(
      normalizeTeamName("Bosnia and Herzegovina"),
    );
  });
});

describe("teamNamesMatch", () => {
  it("casa nomes idênticos (com variação de caixa/acento)", () => {
    expect(teamNamesMatch("Curaçao", "Curacao")).toBe(true);
    expect(teamNamesMatch("Mexico", "mexico")).toBe(true);
  });

  it("casa aliases conhecidos JSON x Football-Data", () => {
    expect(teamNamesMatch("USA", "United States")).toBe(true);
    expect(teamNamesMatch("South Korea", "Korea Republic")).toBe(true);
    expect(teamNamesMatch("Czech Republic", "Czechia")).toBe(true);
    expect(teamNamesMatch("Iran", "IR Iran")).toBe(true);
    expect(teamNamesMatch("Ivory Coast", "Côte d'Ivoire")).toBe(true);
  });

  it("não casa seleções diferentes", () => {
    expect(teamNamesMatch("Brazil", "Argentina")).toBe(false);
    expect(teamNamesMatch("South Korea", "South Africa")).toBe(false);
  });
});

describe("teamCode", () => {
  it("mapeia nome em inglês para o código ISO do DB", () => {
    expect(teamCode("Germany")).toBe("de");
    expect(teamCode("England")).toBe("gb-eng");
    expect(teamCode("Scotland")).toBe("gb-sct");
    expect(teamCode("USA")).toBe("us");
    expect(teamCode("South Korea")).toBe("kr");
    expect(teamCode("Bosnia & Herzegovina")).toBe("ba");
    expect(teamCode("Curaçao")).toBe("cw");
    expect(teamCode("DR Congo")).toBe("cd");
  });

  it("retorna null para seleção desconhecida", () => {
    expect(teamCode("Atlantis")).toBeNull();
  });
});
