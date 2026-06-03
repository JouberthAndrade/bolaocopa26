"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MatchCard } from "@/components/match/match-card";
import { STAGE_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { MatchWithBet } from "@/server/services/matches";
import type { MatchStage } from "@prisma/client";

/** Ordem cronológica das 7 fases da Copa. */
const PHASES: MatchStage[] = ["GROUP", "R32", "R16", "QF", "SF", "THIRD_PLACE", "FINAL"];

/** Datas previstas de início (fallback quando os confrontos ainda não existem). */
const PREDICTED_START: Record<MatchStage, Date> = {
  GROUP: new Date(2026, 5, 11),
  R32: new Date(2026, 5, 28),
  R16: new Date(2026, 6, 4),
  QF: new Date(2026, 6, 9),
  SF: new Date(2026, 6, 14),
  THIRD_PLACE: new Date(2026, 6, 18),
  FINAL: new Date(2026, 6, 19),
};

function formatLongDate(d: Date) {
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
}

export function PhaseView({
  matches,
  poolId,
  groupComplete,
}: {
  matches: MatchWithBet[];
  poolId: string;
  groupComplete: boolean;
}) {
  const byStage = useMemo(() => {
    const map = new Map<MatchStage, MatchWithBet[]>();
    for (const m of matches) {
      if (!map.has(m.stage)) map.set(m.stage, []);
      map.get(m.stage)!.push(m);
    }
    return map;
  }, [matches]);

  // Abre na fase de mata-mata atual: a primeira eliminatória não concluída,
  // ou nas 16-avos por padrão.
  const [idx, setIdx] = useState(() => {
    const firstKnockoutUnfinished = PHASES.findIndex(
      (s, i) =>
        i > 0 &&
        (byStage.get(s) ?? []).some((m) => m.status !== "FINISHED"),
    );
    return firstKnockoutUnfinished >= 0 ? firstKnockoutUnfinished : 1;
  });

  const stage = PHASES[idx];
  const stageMatches = byStage.get(stage) ?? [];
  const fill = ((idx + 1) / PHASES.length) * 100;

  const start = stageMatches[0]
    ? new Date(stageMatches[0].kickoffAt)
    : PREDICTED_START[stage];

  // Eliminatórias ficam fechadas até a fase de grupos terminar.
  const knockoutLocked = stage !== "GROUP" && !groupComplete;
  const showMatches = stageMatches.length > 0 && !knockoutLocked;

  return (
    <div className="space-y-4">
      {/* Controle de fase */}
      <section aria-label="Fase da competição" className="space-y-3">
        <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${fill}%` }}
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Fase anterior"
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            disabled={idx === 0}
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-30"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <div className="flex-1 text-center">
            <h2 className="text-lg font-bold leading-tight">{STAGE_LABEL[stage]}</h2>
            <span className="text-xs text-muted-foreground">
              Fase {idx + 1} de {PHASES.length}
            </span>
          </div>
          <button
            type="button"
            aria-label="Próxima fase"
            onClick={() => setIdx((i) => Math.min(PHASES.length - 1, i + 1))}
            disabled={idx === PHASES.length - 1}
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-30"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>
      </section>

      {/* Conteúdo da fase */}
      {showMatches ? (
        <div className="space-y-3">
          {stageMatches.map((m) => (
            <MatchCard key={m.id} match={m} poolId={poolId} />
          ))}
        </div>
      ) : (
        <EmptyPhase
          label={STAGE_LABEL[stage]}
          start={start}
          reason={
            knockoutLocked
              ? "Os confrontos são definidos após a fase de grupos."
              : "Os confrontos desta fase ainda não foram definidos."
          }
        />
      )}
    </div>
  );
}

function EmptyPhase({
  label,
  start,
  reason,
}: {
  label: string;
  start: Date;
  reason: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card px-6 py-12 text-center">
      <span className="text-5xl" aria-hidden>🏆</span>
      <h3 className="text-lg font-semibold">{label}</h3>
      <p className="max-w-xs text-sm text-muted-foreground">{reason}</p>
      <p className="text-sm font-medium capitalize text-primary">
        Previsto para começar em {formatLongDate(start)}.
      </p>
    </div>
  );
}
