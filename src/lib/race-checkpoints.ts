// Checkpoints da "corrida pelo prêmio" — funções PURAS (sem React/banco), para
// serem testáveis. Cada checkpoint marca um ponto da linha do tempo (rodada, dia
// ou jogo) e o índice do último jogo incluído (`cutoff`) nas `matches` ordenadas
// cronologicamente. O acúmulo de pontos por checkpoint é feito no componente.

import { STAGE_LABEL } from "@/lib/labels";
import type { RaceMatch } from "@/server/services/race";

export type RaceMode = "round" | "day" | "game";

export interface Checkpoint {
  key: string;
  label: string;
  /** índice do último jogo (inclusive) deste checkpoint em `matches` ordenados */
  cutoff: number;
}

/** Dispatcher por modo. */
export function buildCheckpoints(mode: RaceMode, matches: RaceMatch[]): Checkpoint[] {
  if (mode === "day") return buildDayCheckpoints(matches);
  if (mode === "game") return buildGameCheckpoints(matches);
  return buildRoundCheckpoints(matches);
}

/** Um checkpoint por rodada/fase, em ordem cronológica. */
export function buildRoundCheckpoints(matches: RaceMatch[]): Checkpoint[] {
  const order: string[] = [];
  const lastIdx = new Map<string, number>();
  matches.forEach((m, i) => {
    const key = m.stage === "GROUP" ? `g${m.matchday ?? 0}` : m.stage;
    if (!lastIdx.has(key)) order.push(key);
    lastIdx.set(key, i);
  });
  return order.map((key) => ({
    key,
    label: roundLabel(key, matches[lastIdx.get(key)!]),
    cutoff: lastIdx.get(key)!,
  }));
}

function roundLabel(key: string, m: RaceMatch): string {
  if (key.startsWith("g")) return `Rodada ${key.slice(1)}`;
  return STAGE_LABEL[m.stage];
}

/** Um checkpoint por dia (fuso local), em ordem cronológica. */
export function buildDayCheckpoints(matches: RaceMatch[]): Checkpoint[] {
  const order: string[] = [];
  const lastIdx = new Map<string, number>();
  const firstDate = new Map<string, Date>();
  matches.forEach((m, i) => {
    const d = new Date(m.kickoffAt);
    const key = d.toLocaleDateString("pt-BR");
    if (!lastIdx.has(key)) {
      order.push(key);
      firstDate.set(key, d);
    }
    lastIdx.set(key, i);
  });
  return order.map((key) => ({
    key,
    label: dayLabel(firstDate.get(key)!),
    cutoff: lastIdx.get(key)!,
  }));
}

/** Um checkpoint por JOGO, em ordem cronológica (progressão partida a partida). */
export function buildGameCheckpoints(matches: RaceMatch[]): Checkpoint[] {
  return matches.map((m, i) => ({
    key: m.matchId,
    label: `${m.homeCode} × ${m.awayCode}`,
    cutoff: i,
  }));
}

/** "Hoje" / "Ontem" / "sex., 12/06". */
function dayLabel(date: Date): string {
  const startOf = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((startOf(date) - startOf(new Date())) / 86_400_000);
  if (diff === 0) return "Hoje";
  if (diff === -1) return "Ontem";
  if (diff === 1) return "Amanhã";
  return date.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}
