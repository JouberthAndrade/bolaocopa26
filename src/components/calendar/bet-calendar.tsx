"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Flag } from "@/components/flag";
import { MatchCard } from "@/components/match/match-card";
import { Dialog } from "@/components/ui/dialog";
import { isBettable, cn } from "@/lib/utils";
import type { MatchWithBet } from "@/server/services/matches";

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** Chave local YYYY-MM-DD (usa o fuso do usuário, igual aos horários exibidos). */
function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function timeOf(d: Date) {
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function BetCalendar({
  matches,
  poolId,
}: {
  matches: MatchWithBet[];
  poolId: string;
}) {
  // Agrupa jogos por dia local.
  const byDay = useMemo(() => {
    const map = new Map<string, MatchWithBet[]>();
    for (const m of matches) {
      const k = dayKey(new Date(m.kickoffAt));
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(m);
    }
    return map;
  }, [matches]);

  // Meses que contêm jogos (do primeiro ao último).
  const months = useMemo(() => {
    if (matches.length === 0) {
      const now = new Date();
      return [{ year: now.getFullYear(), month: now.getMonth() }];
    }
    const first = new Date(matches[0].kickoffAt);
    const last = new Date(matches[matches.length - 1].kickoffAt);
    const out: { year: number; month: number }[] = [];
    const cur = new Date(first.getFullYear(), first.getMonth(), 1);
    const end = new Date(last.getFullYear(), last.getMonth(), 1);
    while (cur <= end) {
      out.push({ year: cur.getFullYear(), month: cur.getMonth() });
      cur.setMonth(cur.getMonth() + 1);
    }
    return out;
  }, [matches]);

  // Começa no mês de hoje, se houver jogos nele; senão no primeiro mês.
  const [idx, setIdx] = useState(() => {
    const now = new Date();
    const i = months.findIndex(
      (m) => m.year === now.getFullYear() && m.month === now.getMonth(),
    );
    return i >= 0 ? i : 0;
  });

  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const { year, month } = months[idx];
  const todayKey = dayKey(new Date());

  // Monta as células do grid (blanks + dias).
  const cells = useMemo(() => {
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const list: ({ day: number; key: string } | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) list.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      list.push({ day: d, key: `${year}-${month}-${d}` });
    }
    return list;
  }, [year, month]);

  const selectedMatches = selectedKey ? byDay.get(selectedKey) ?? [] : [];
  const selectedDate = selectedMatches[0] ? new Date(selectedMatches[0].kickoffAt) : null;

  return (
    <section className="rounded-2xl border border-border bg-card">
      {/* Navegação de mês */}
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <button
          type="button"
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={idx === 0}
          aria-label="Mês anterior"
          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-30"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h2 className="text-base font-bold">
          {MONTHS[month]} de {year}
        </h2>
        <button
          type="button"
          onClick={() => setIdx((i) => Math.min(months.length - 1, i + 1))}
          disabled={idx === months.length - 1}
          aria-label="Próximo mês"
          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-30"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </header>

      {/* Grade */}
      <div className="p-2 sm:p-3">
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {WEEKDAYS.map((w) => (
            <div
              key={w}
              className="py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-xs"
            >
              {w}
            </div>
          ))}

          {cells.map((cell, i) => {
            if (!cell) return <div key={`b${i}`} className="min-h-16" />;
            const dayMatches = byDay.get(cell.key) ?? [];
            const has = dayMatches.length > 0;
            const isToday = cell.key === todayKey;

            return (
              <button
                key={cell.key}
                type="button"
                disabled={!has}
                onClick={() => has && setSelectedKey(cell.key)}
                className={cn(
                  "flex min-h-16 flex-col gap-1 rounded-lg border p-1 text-left transition-colors sm:min-h-20 sm:p-1.5",
                  has
                    ? "cursor-pointer border-border bg-secondary/30 hover:border-primary hover:bg-secondary/60"
                    : "border-transparent",
                  isToday && "border-primary/60 ring-1 ring-primary/40",
                )}
              >
                <span
                  className={cn(
                    "text-[11px] font-semibold sm:text-xs",
                    isToday ? "text-primary" : has ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {cell.day}
                </span>
                {has && <DayEvents matches={dayMatches} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Popup do dia */}
      <Dialog
        open={selectedKey !== null}
        onClose={() => setSelectedKey(null)}
        title={
          selectedDate
            ? selectedDate.toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "2-digit",
                month: "long",
              })
            : "Jogos do dia"
        }
        description={`${selectedMatches.length} ${selectedMatches.length === 1 ? "jogo" : "jogos"} · palpite até 20 min antes`}
      >
        {selectedMatches.map((m) => (
          <MatchCard key={m.id} match={m} poolId={poolId} />
        ))}
      </Dialog>
    </section>
  );
}

/** Mini-eventos dentro da célula: bandeiras + horário, no máximo 3 visíveis. */
function DayEvents({ matches }: { matches: MatchWithBet[] }) {
  const visible = matches.slice(0, 3);
  const extra = matches.length - visible.length;

  return (
    <div className="flex flex-col gap-0.5">
      {visible.map((m) => {
        const betDone = !!m.bet;
        const open = isBettable(m.lockAt) && m.status === "SCHEDULED";
        return (
          <div
            key={m.id}
            title={`${m.home.name} × ${m.away.name} · ${timeOf(new Date(m.kickoffAt))}`}
            className={cn(
              "flex items-center gap-1 rounded px-0.5 py-px text-[9px] leading-none sm:text-[10px]",
              betDone
                ? "bg-primary/15 text-primary"
                : open
                  ? "text-muted-foreground"
                  : "text-muted-foreground/60",
            )}
          >
            <Flag countryCode={m.home.countryCode} name={m.home.name} size={14} />
            <Flag countryCode={m.away.countryCode} name={m.away.name} size={14} />
            <span className="ml-auto tabular-nums">{timeOf(new Date(m.kickoffAt))}</span>
          </div>
        );
      })}
      {extra > 0 && (
        <span className="flex items-center gap-0.5 pl-0.5 text-[9px] text-muted-foreground sm:text-[10px]">
          <CalendarDays className="h-2.5 w-2.5" />+{extra}
        </span>
      )}
    </div>
  );
}
