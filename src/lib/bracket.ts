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
  | { kind: "winner_sf"; n: number; label: string }
  | { kind: "loser_sf"; n: number; label: string };

export interface BracketMatch {
  /** Número oficial FIFA do jogo (73–104). */
  matchNo: number;
  /** Rótulo curto exibido no card ("segunda fase 1", "oitavas 1", …). */
  slotLabel: string;
  home: BracketSlot;
  away: BracketSlot;
  /** Data prevista (ISO yyyy-mm-dd) — usada só no preview virtual. */
  predictedDate: string;
  /** Cidade-sede (pt-BR). */
  venue: string;
}

// ─── FIFA 2026 Bracket ───────────────────────────────────────────────────────
// Estrutura oficial publicada pela FIFA (Wikipedia: 2026 FIFA World Cup knockout
// stage). 12 grupos (A–L): 8 melhores 3º colocados também avançam. A alocação
// específica dos 3º colocados depende de QUAIS oito se classificam (495
// combinações no Anexo C do regulamento) — por isso os slots `best_3` só exibem
// o rótulo (3°ABCDF…) até o mata-mata real ser sincronizado com as equipes.
//
// Datas/sedes: R32 de 28/06 a 03/07; oitavas 04–07/07; quartas 09–11/07;
// semis 14–15/07; 3º lugar 18/07; final 19/07 (MetLife, Nova Jersey).

export const FIFA_2026_R32: BracketMatch[] = [
  { matchNo: 73, slotLabel: "segunda fase 1",  predictedDate: "2026-06-28", venue: "Los Angeles",       home: { kind: "group_2", group: "A", label: "2°A" }, away: { kind: "group_2", group: "B", label: "2°B" } },
  { matchNo: 74, slotLabel: "segunda fase 2",  predictedDate: "2026-06-29", venue: "Boston",            home: { kind: "group_1", group: "E", label: "1°E" }, away: { kind: "best_3", groups: ["A","B","C","D","F"], label: "3°ABCDF" } },
  { matchNo: 75, slotLabel: "segunda fase 3",  predictedDate: "2026-06-29", venue: "Monterrey",         home: { kind: "group_1", group: "F", label: "1°F" }, away: { kind: "group_2", group: "C", label: "2°C" } },
  { matchNo: 76, slotLabel: "segunda fase 4",  predictedDate: "2026-06-29", venue: "Houston",           home: { kind: "group_1", group: "C", label: "1°C" }, away: { kind: "group_2", group: "F", label: "2°F" } },
  { matchNo: 77, slotLabel: "segunda fase 5",  predictedDate: "2026-06-30", venue: "Nova Jersey",       home: { kind: "group_1", group: "I", label: "1°I" }, away: { kind: "best_3", groups: ["C","D","F","G","H"], label: "3°CDFGH" } },
  { matchNo: 78, slotLabel: "segunda fase 6",  predictedDate: "2026-06-30", venue: "Dallas",            home: { kind: "group_2", group: "E", label: "2°E" }, away: { kind: "group_2", group: "I", label: "2°I" } },
  { matchNo: 79, slotLabel: "segunda fase 7",  predictedDate: "2026-06-30", venue: "Cidade do México",  home: { kind: "group_1", group: "A", label: "1°A" }, away: { kind: "best_3", groups: ["C","E","F","H","I"], label: "3°CEFHI" } },
  { matchNo: 80, slotLabel: "segunda fase 8",  predictedDate: "2026-07-01", venue: "Atlanta",           home: { kind: "group_1", group: "L", label: "1°L" }, away: { kind: "best_3", groups: ["E","H","I","J","K"], label: "3°EHIJK" } },
  { matchNo: 81, slotLabel: "segunda fase 9",  predictedDate: "2026-07-01", venue: "São Francisco",     home: { kind: "group_1", group: "D", label: "1°D" }, away: { kind: "best_3", groups: ["B","E","F","I","J"], label: "3°BEFIJ" } },
  { matchNo: 82, slotLabel: "segunda fase 10", predictedDate: "2026-07-01", venue: "Seattle",           home: { kind: "group_1", group: "G", label: "1°G" }, away: { kind: "best_3", groups: ["A","E","H","I","J"], label: "3°AEHIJ" } },
  { matchNo: 83, slotLabel: "segunda fase 11", predictedDate: "2026-07-02", venue: "Toronto",           home: { kind: "group_2", group: "K", label: "2°K" }, away: { kind: "group_2", group: "L", label: "2°L" } },
  { matchNo: 84, slotLabel: "segunda fase 12", predictedDate: "2026-07-02", venue: "Los Angeles",       home: { kind: "group_1", group: "H", label: "1°H" }, away: { kind: "group_2", group: "J", label: "2°J" } },
  { matchNo: 85, slotLabel: "segunda fase 13", predictedDate: "2026-07-02", venue: "Vancouver",         home: { kind: "group_1", group: "B", label: "1°B" }, away: { kind: "best_3", groups: ["E","F","G","I","J"], label: "3°EFGIJ" } },
  { matchNo: 86, slotLabel: "segunda fase 14", predictedDate: "2026-07-03", venue: "Miami",             home: { kind: "group_1", group: "J", label: "1°J" }, away: { kind: "group_2", group: "H", label: "2°H" } },
  { matchNo: 87, slotLabel: "segunda fase 15", predictedDate: "2026-07-03", venue: "Kansas City",       home: { kind: "group_1", group: "K", label: "1°K" }, away: { kind: "best_3", groups: ["D","E","I","J","L"], label: "3°DEIJL" } },
  { matchNo: 88, slotLabel: "segunda fase 16", predictedDate: "2026-07-03", venue: "Dallas",            home: { kind: "group_2", group: "D", label: "2°D" }, away: { kind: "group_2", group: "G", label: "2°G" } },
];

/** Rótulo do vencedor de um jogo da 2ª fase (sfIndex = matchNo − 72). */
const sfWin = (matchNo: number) => ({
  kind: "winner_r32" as const,
  n: matchNo,
  label: `Venc. 2ª fase ${matchNo - 72}`,
});

// Oitavas (M89–M96). Conexões oficiais por número de jogo.
export const FIFA_2026_R16: BracketMatch[] = [
  { matchNo: 89, slotLabel: "oitavas 1", predictedDate: "2026-07-04", venue: "Filadélfia",      home: sfWin(73), away: sfWin(75) },
  { matchNo: 90, slotLabel: "oitavas 2", predictedDate: "2026-07-04", venue: "Houston",         home: sfWin(74), away: sfWin(77) },
  { matchNo: 91, slotLabel: "oitavas 3", predictedDate: "2026-07-05", venue: "Nova Jersey",     home: sfWin(76), away: sfWin(78) },
  { matchNo: 92, slotLabel: "oitavas 4", predictedDate: "2026-07-05", venue: "Cidade do México",home: sfWin(79), away: sfWin(80) },
  { matchNo: 93, slotLabel: "oitavas 5", predictedDate: "2026-07-06", venue: "Dallas",          home: sfWin(83), away: sfWin(84) },
  { matchNo: 94, slotLabel: "oitavas 6", predictedDate: "2026-07-06", venue: "Seattle",         home: sfWin(81), away: sfWin(82) },
  { matchNo: 95, slotLabel: "oitavas 7", predictedDate: "2026-07-07", venue: "Atlanta",         home: sfWin(86), away: sfWin(88) },
  { matchNo: 96, slotLabel: "oitavas 8", predictedDate: "2026-07-07", venue: "Vancouver",       home: sfWin(85), away: sfWin(87) },
];

/** Rótulo do vencedor de uma oitava (oIndex = matchNo − 88). */
const r16Win = (matchNo: number) => ({
  kind: "winner_r16" as const,
  n: matchNo,
  label: `Venc. oitavas ${matchNo - 88}`,
});

// Quartas (M97–M100): pares sequenciais de oitavas no bracket.
export const FIFA_2026_QF: BracketMatch[] = [
  { matchNo: 97,  slotLabel: "quartas 1", predictedDate: "2026-07-09", venue: "Boston",      home: r16Win(89), away: r16Win(90) },
  { matchNo: 98,  slotLabel: "quartas 2", predictedDate: "2026-07-10", venue: "Los Angeles", home: r16Win(91), away: r16Win(92) },
  { matchNo: 99,  slotLabel: "quartas 3", predictedDate: "2026-07-11", venue: "Miami",       home: r16Win(93), away: r16Win(94) },
  { matchNo: 100, slotLabel: "quartas 4", predictedDate: "2026-07-11", venue: "Kansas City", home: r16Win(95), away: r16Win(96) },
];

/** Rótulo do vencedor de uma quarta (qIndex = matchNo − 96). */
const qfWin = (matchNo: number) => ({
  kind: "winner_qf" as const,
  n: matchNo,
  label: `Venc. quartas ${matchNo - 96}`,
});

// Semifinais (M101–M102).
export const FIFA_2026_SF: BracketMatch[] = [
  { matchNo: 101, slotLabel: "semifinal 1", predictedDate: "2026-07-14", venue: "Dallas",  home: qfWin(97), away: qfWin(98) },
  { matchNo: 102, slotLabel: "semifinal 2", predictedDate: "2026-07-15", venue: "Atlanta", home: qfWin(99), away: qfWin(100) },
];

// Disputa de 3º lugar (M103): perdedores das semis.
export const FIFA_2026_THIRD: BracketMatch[] = [
  {
    matchNo: 103, slotLabel: "3° lugar", predictedDate: "2026-07-18", venue: "Miami",
    home: { kind: "loser_sf", n: 101, label: "Perd. semifinal 1" },
    away: { kind: "loser_sf", n: 102, label: "Perd. semifinal 2" },
  },
];

// Final (M104): vencedores das semis (MetLife, Nova Jersey).
export const FIFA_2026_FINAL: BracketMatch[] = [
  {
    matchNo: 104, slotLabel: "final", predictedDate: "2026-07-19", venue: "Nova Jersey",
    home: { kind: "winner_sf", n: 101, label: "Venc. semifinal 1" },
    away: { kind: "winner_sf", n: 102, label: "Venc. semifinal 2" },
  },
];

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
 * Resolve um slot do bracket para um time real, no estilo ESPN: o time só é
 * preenchido quando já está definido. Caso contrário devolve `null` e a UI
 * exibe o rótulo (1°A, 3°ABCDF, "Venc. 2ª fase 1"…).
 *
 * - `group_1`/`group_2`: resolve apenas se o grupo já terminou (`completeGroups`),
 *   pois antes disso a posição final não é confiável.
 * - `best_3`: nunca resolvido em memória — a alocação dos 8 melhores 3º depende
 *   da combinação exata de classificados; mostra o rótulo até o sync real.
 * - `winner_*`/`loser_sf`: não resolvíveis em memória — sempre rótulo.
 */
export function resolveSlot(
  slot: BracketSlot,
  standings: Map<string, TeamStanding[]>,
  completeGroups: Set<string>,
): { team: { name: string; countryCode: string } | null; label: string } {
  if (slot.kind === "group_1" && completeGroups.has(slot.group)) {
    const team = standings.get(slot.group)?.[0];
    if (team) return { team: { name: team.name, countryCode: team.countryCode }, label: slot.label };
  }
  if (slot.kind === "group_2" && completeGroups.has(slot.group)) {
    const team = standings.get(slot.group)?.[1];
    if (team) return { team: { name: team.name, countryCode: team.countryCode }, label: slot.label };
  }
  // best_3, winner_*, loser_sf, e grupos ainda não encerrados → rótulo
  return { team: null, label: slot.label };
}
