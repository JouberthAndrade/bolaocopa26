"use client";

import { useMemo, useState } from "react";
import { CalendarRange, LayoutGrid, ChevronLeft, ChevronRight } from "lucide-react";
import { MatchCard } from "@/components/match/match-card";
import { GroupMatchesAccordion } from "@/components/match/group-matches-accordion";
import { cn } from "@/lib/utils";
import type { MatchWithBet } from "@/server/services/matches";

type ViewMode = "rounds" | "groups";

/** Rodadas da fase de grupos (1, 2, 3) presentes nos jogos, em ordem. */
function getRounds(matches: MatchWithBet[]): number[] {
  const set = new Set<number>();
  for (const m of matches) {
    if (m.stage === "GROUP" && m.matchday != null) set.add(m.matchday);
  }
  return [...set].sort((a, b) => a - b);
}

/**
 * Rodada "atual": a primeira que ainda tem jogo não finalizado (a próxima a
 * palpitar). Se todas terminaram, mostra a última. Espelha o currentMatchday
 * da API sem depender de um campo extra no banco.
 */
function getCurrentRound(matches: MatchWithBet[], rounds: number[]): number {
  for (const r of rounds) {
    if (matches.some((m) => m.matchday === r && m.status !== "FINISHED")) return r;
  }
  return rounds[rounds.length - 1] ?? 1;
}

export function MatchesExplorer({
  matches,
  poolId,
}: {
  matches: MatchWithBet[];
  poolId: string;
}) {
  const rounds = useMemo(() => getRounds(matches), [matches]);
  const defaultRound = useMemo(
    () => getCurrentRound(matches, rounds),
    [matches, rounds],
  );

  // Estados independentes: o modo de navegação e a rodada não se acoplam ao grupo.
  const [mode, setMode] = useState<ViewMode>("rounds");
  const [round, setRound] = useState<number>(defaultRound);

  const activeRound = rounds.includes(round) ? round : defaultRound;

  // Jogos da rodada ativa — todos os grupos misturados, em ordem de horário.
  const roundMatches = useMemo(
    () =>
      matches
        .filter((m) => m.stage === "GROUP" && m.matchday === activeRound)
        .sort(
          (a, b) =>
            new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime(),
        ),
    [matches, activeRound],
  );

  return (
    <div className="space-y-4">
      <ViewToggle mode={mode} onChange={setMode} />

      {mode === "groups" ? (
        <GroupMatchesAccordion matches={matches} poolId={poolId} />
      ) : (
        <div className="space-y-4">
          {rounds.length > 1 && (
            <RoundNavigator rounds={rounds} active={activeRound} onChange={setRound} />
          )}
          <RoundList matches={roundMatches} poolId={poolId} />
        </div>
      )}
    </div>
  );
}

/** Alterna entre navegar por rodada (lista corrida) e por grupo (tabelas). */
function ViewToggle({
  mode,
  onChange,
}: {
  mode: ViewMode;
  onChange: (m: ViewMode) => void;
}) {
  const items = [
    { key: "rounds" as const, label: "Por rodada", Icon: CalendarRange },
    { key: "groups" as const, label: "Por grupo", Icon: LayoutGrid },
  ];
  return (
    <div className="flex gap-1 rounded-full border border-border bg-card p-1">
      {items.map(({ key, label, Icon }) => {
        const isActive = mode === key;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(key)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

/** Seletor de rodada: setas ‹ › + abas de cada rodada (1, 2, 3). */
function RoundNavigator({
  rounds,
  active,
  onChange,
}: {
  rounds: number[];
  active: number;
  onChange: (r: number) => void;
}) {
  const i = rounds.indexOf(active);
  const atStart = i <= 0;
  const atEnd = i >= rounds.length - 1;

  const arrow =
    "shrink-0 rounded-full border border-border bg-card p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:pointer-events-none disabled:opacity-40";

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label="Rodada anterior"
        disabled={atStart}
        onClick={() => !atStart && onChange(rounds[i - 1])}
        className={arrow}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div
        role="tablist"
        aria-label="Rodadas"
        className="flex flex-1 gap-1 rounded-full border border-border bg-card p-1"
      >
        {rounds.map((r) => {
          const isActive = r === active;
          return (
            <button
              key={r}
              role="tab"
              type="button"
              aria-selected={isActive}
              onClick={() => onChange(r)}
              className={cn(
                "flex-1 rounded-full px-2 py-1.5 text-sm font-semibold transition-colors",
                isActive
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="tabular-nums">Rodada {r}</span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        aria-label="Próxima rodada"
        disabled={atEnd}
        onClick={() => !atEnd && onChange(rounds[i + 1])}
        className={arrow}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Lista corrida dos jogos da rodada, com cabeçalho leve por dia (estilo GE). */
function RoundList({
  matches,
  poolId,
}: {
  matches: MatchWithBet[];
  poolId: string;
}) {
  const days = useMemo(() => groupByDay(matches), [matches]);

  if (matches.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card py-10 text-center text-sm text-muted-foreground">
        Nenhum jogo nesta rodada.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {days.map((day) => (
        <section key={day.key} className="space-y-3">
          <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {day.label}
          </h3>
          <div className="space-y-3">
            {day.matches.map((m) => (
              <MatchCard key={m.id} match={m} poolId={poolId} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

interface DayBucket {
  key: string;
  label: string;
  matches: MatchWithBet[];
}

/** Agrupa jogos (já ordenados) por dia de início, preservando a ordem. */
function groupByDay(matches: MatchWithBet[]): DayBucket[] {
  const buckets = new Map<string, MatchWithBet[]>();
  for (const m of matches) {
    const key = new Date(m.kickoffAt).toLocaleDateString("pt-BR");
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(m);
  }
  return [...buckets.entries()].map(([key, ms]) => ({
    key,
    label: formatDayLabel(new Date(ms[0].kickoffAt)),
    matches: ms,
  }));
}

/** "Hoje · sex., 12/06" / "Amanhã · …" / "Ontem · …" ou só a data. */
function formatDayLabel(date: Date): string {
  const startOf = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOf(date) - startOf(new Date())) / 86_400_000);
  const rel =
    diffDays === 0
      ? "Hoje"
      : diffDays === 1
        ? "Amanhã"
        : diffDays === -1
          ? "Ontem"
          : null;
  const formatted = date.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
  return rel ? `${rel} · ${formatted}` : formatted;
}
