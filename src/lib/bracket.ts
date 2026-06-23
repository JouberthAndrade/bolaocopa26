import type { MatchStage } from "@prisma/client";
import type { TeamStanding } from "./group";

// ─── Types ───────────────────────────────────────────────────────────────────

export type BracketSlot =
  | { kind: "group_1"; group: string; label: string }
  | { kind: "group_2"; group: string; label: string }
  | { kind: "best_3"; groups: string[]; label: string }
  | { kind: "winner_r32"; n: number; label: string }
  | { kind: "winner_r16"; n: number; label: string }
  | { kind: "winner_qf"; n: number; label: string }
  | { kind: "loser_sf"; n: number; label: string };

export interface BracketMatch {
  slotLabel: string;
  home: BracketSlot;
  away: BracketSlot;
}

// ─── FIFA 2026 Bracket Constants ─────────────────────────────────────────────
// Fonte: FIFA.com/en/tournaments/mens/worldcup/2026canada-mexico-usa/bracket
// Verificar matchday ordering via football-data.org API (LAST_32 stage).
// Exemplos confirmados pelas imagens de referência:
//   md1: 1°E vs 3°(A/B/C/D/F)   — Boston
//   md2: 1°I vs 3°(C/D/F/G/H)   — New Jersey
//   md3: 2°A vs 2°B              — Los Angeles
//
// KNOWN LIMITATION: md4–md16 são estimativas. A API football-data.org retornou
// os 16 jogos do LAST_32 mas todos com matchday=null e equipes TBD (exceto GER
// e MEX como mandantes), impossibilitando verificação de ordem/slots.
// Estes valores devem ser revisados quando o chaveamento oficial FIFA 2026 for
// publicado com os placeholders de grupo confirmados.

export const FIFA_2026_R32: BracketMatch[] = [
  // md1
  { slotLabel: "segunda fase 1",  home: { kind: "group_1", group: "E", label: "1°E" },  away: { kind: "best_3", groups: ["A","B","C","D","F"], label: "3°ABCDF" } },
  // md2
  { slotLabel: "segunda fase 2",  home: { kind: "group_1", group: "I", label: "1°I" },  away: { kind: "best_3", groups: ["C","D","F","G","H"], label: "3°CDFGH" } },
  // md3
  { slotLabel: "segunda fase 3",  home: { kind: "group_2", group: "A", label: "2°A" },  away: { kind: "group_2", group: "B", label: "2°B" } },
  // md4 — preencher com resultado do fetch da API
  { slotLabel: "segunda fase 4",  home: { kind: "group_1", group: "A", label: "1°A" },  away: { kind: "best_3", groups: ["D","E","F","G","H"], label: "3°DEFGH" } },
  // md5
  { slotLabel: "segunda fase 5",  home: { kind: "group_1", group: "C", label: "1°C" },  away: { kind: "best_3", groups: ["A","B","E","I","J"], label: "3°ABEIJ" } },
  // md6
  { slotLabel: "segunda fase 6",  home: { kind: "group_2", group: "C", label: "2°C" },  away: { kind: "group_2", group: "D", label: "2°D" } },
  // md7
  { slotLabel: "segunda fase 7",  home: { kind: "group_1", group: "B", label: "1°B" },  away: { kind: "group_2", group: "I", label: "2°I" } },
  // md8
  { slotLabel: "segunda fase 8",  home: { kind: "group_2", group: "E", label: "2°E" },  away: { kind: "group_2", group: "H", label: "2°H" } },
  // md9
  { slotLabel: "segunda fase 9",  home: { kind: "group_1", group: "D", label: "1°D" },  away: { kind: "best_3", groups: ["E","F","G","I","J"], label: "3°EFGIJ" } },
  // md10
  { slotLabel: "segunda fase 10", home: { kind: "group_1", group: "H", label: "1°H" },  away: { kind: "group_2", group: "G", label: "2°G" } },
  // md11
  { slotLabel: "segunda fase 11", home: { kind: "group_1", group: "F", label: "1°F" },  away: { kind: "best_3", groups: ["G","H","I","J","K"], label: "3°GHIJK" } },
  // md12
  { slotLabel: "segunda fase 12", home: { kind: "group_2", group: "F", label: "2°F" },  away: { kind: "best_3", groups: ["A","B","C","K","L"], label: "3°ABCKL" } },
  // md13
  { slotLabel: "segunda fase 13", home: { kind: "group_1", group: "G", label: "1°G" },  away: { kind: "group_2", group: "J", label: "2°J" } },
  // md14
  { slotLabel: "segunda fase 14", home: { kind: "group_2", group: "K", label: "2°K" },  away: { kind: "group_2", group: "L", label: "2°L" } },
  // md15
  { slotLabel: "segunda fase 15", home: { kind: "group_1", group: "K", label: "1°K" },  away: { kind: "best_3", groups: ["D","E","H","J","L"], label: "3°DEHJL" } },
  // md16
  { slotLabel: "segunda fase 16", home: { kind: "group_1", group: "J", label: "1°J" },  away: { kind: "group_1", group: "L", label: "1°L" } },
];

// R16: vencedores do R32 se enfrentam em pares sequenciais (1 vs 2, 3 vs 4, ...)
export const FIFA_2026_R16: BracketMatch[] = Array.from({ length: 8 }, (_, i) => ({
  slotLabel: `oitavas ${i + 1}`,
  home: { kind: "winner_r32" as const, n: i * 2 + 1, label: `Venc. R32-${i * 2 + 1}` },
  away: { kind: "winner_r32" as const, n: i * 2 + 2, label: `Venc. R32-${i * 2 + 2}` },
}));

export const FIFA_2026_QF: BracketMatch[] = Array.from({ length: 4 }, (_, i) => ({
  slotLabel: `quartas ${i + 1}`,
  home: { kind: "winner_r16" as const, n: i * 2 + 1, label: `Venc. Oitavas ${i * 2 + 1}` },
  away: { kind: "winner_r16" as const, n: i * 2 + 2, label: `Venc. Oitavas ${i * 2 + 2}` },
}));

export const FIFA_2026_SF: BracketMatch[] = Array.from({ length: 2 }, (_, i) => ({
  slotLabel: `semifinal ${i + 1}`,
  home: { kind: "winner_qf" as const, n: i * 2 + 1, label: `Venc. Quartas ${i * 2 + 1}` },
  away: { kind: "winner_qf" as const, n: i * 2 + 2, label: `Venc. Quartas ${i * 2 + 2}` },
}));

export const FIFA_2026_THIRD: BracketMatch[] = [{
  slotLabel: "3° lugar",
  home: { kind: "loser_sf", n: 1, label: "Perd. Semif. 1" },
  away: { kind: "loser_sf", n: 2, label: "Perd. Semif. 2" },
}];

export const FIFA_2026_FINAL: BracketMatch[] = [{
  slotLabel: "final",
  home: { kind: "winner_qf", n: 5, label: "Venc. Semif. 1" },
  away: { kind: "winner_qf", n: 6, label: "Venc. Semif. 2" },
}];

// Map from MatchStage to bracket array
export const BRACKET_BY_STAGE: Partial<Record<MatchStage, BracketMatch[]>> = {
  R32: FIFA_2026_R32,
  R16: FIFA_2026_R16,
  QF: FIFA_2026_QF,
  SF: FIFA_2026_SF,
  THIRD_PLACE: FIFA_2026_THIRD,
  FINAL: FIFA_2026_FINAL,
};

// ─── Resolution ──────────────────────────────────────────────────────────────

/**
 * Resolve um slot do bracket para um time real (a partir dos standings atuais)
 * ou retorna null se o time ainda não pode ser determinado.
 */
export function resolveSlot(
  slot: BracketSlot,
  standings: Map<string, TeamStanding[]>,
): { team: { name: string; countryCode: string } | null; label: string } {
  if (slot.kind === "group_1") {
    const team = standings.get(slot.group)?.[0];
    return { team: team ? { name: team.name, countryCode: team.countryCode } : null, label: slot.label };
  }
  if (slot.kind === "group_2") {
    const team = standings.get(slot.group)?.[1];
    return { team: team ? { name: team.name, countryCode: team.countryCode } : null, label: slot.label };
  }
  if (slot.kind === "best_3") {
    const team = findBest3rd(standings, slot.groups);
    return { team, label: slot.label };
  }
  // winner_r32, winner_r16, winner_qf, loser_sf — não resolvíveis em memória
  return { team: null, label: slot.label };
}

/**
 * Determina o melhor 3° colocado entre os grupos indicados.
 * Ranking: pontos → saldo gols → gols marcados.
 * Retorna o time em posição 3 do grupo com melhor classificação entre allowedGroups.
 */
function findBest3rd(
  standings: Map<string, TeamStanding[]>,
  allowedGroups: string[],
): { name: string; countryCode: string } | null {
  type Entry = { name: string; countryCode: string; points: number; goalDiff: number; goalsFor: number };
  const thirds: Entry[] = [];

  for (const g of allowedGroups) {
    const groupStandings = standings.get(g);
    const third = groupStandings?.[2];
    if (third) {
      thirds.push({
        name: third.name,
        countryCode: third.countryCode,
        points: third.points,
        goalDiff: third.goalDiff,
        goalsFor: third.goalsFor,
      });
    }
  }

  if (thirds.length === 0) return null;

  thirds.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
    return b.goalsFor - a.goalsFor;
  });

  return { name: thirds[0].name, countryCode: thirds[0].countryCode };
}
