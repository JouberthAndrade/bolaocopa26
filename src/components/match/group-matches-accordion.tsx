"use client";

import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Flag } from "@/components/flag";
import { MatchCard } from "@/components/match/match-card";
import { cn } from "@/lib/utils";
import { normalizeGroup } from "@/lib/group";
import type { MatchWithBet } from "@/server/services/matches";

/**
 * Agrupa partidas pela letra do grupo (A, B, C…), ignorando jogos sem grupo
 * (ex.: mata-mata). Dentro de cada grupo, ordena por horário de início.
 * Retorna um objeto { A: Match[], B: Match[], ... } com as chaves em ordem
 * alfabética.
 */
export function groupMatchesByGroup(
  matches: MatchWithBet[],
): Record<string, MatchWithBet[]> {
  const byGroup: Record<string, MatchWithBet[]> = {};
  for (const m of matches) {
    if (!m.group) continue;
    const key = normalizeGroup(m.group);
    if (!key) continue;
    (byGroup[key] ??= []).push(m);
  }
  const ordered: Record<string, MatchWithBet[]> = {};
  for (const key of Object.keys(byGroup).sort()) {
    ordered[key] = byGroup[key].sort(
      (a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime(),
    );
  }
  return ordered;
}

/** Seleções distintas de um grupo (para as bandeiras do card). */
function groupTeams(ms: MatchWithBet[]) {
  const seen = new Map<string, { name: string; countryCode: string | null }>();
  for (const m of ms) {
    if (!seen.has(m.home.name)) seen.set(m.home.name, m.home);
    if (!seen.has(m.away.name)) seen.set(m.away.name, m.away);
  }
  return [...seen.values()];
}

export function GroupMatchesAccordion({
  matches,
  poolId,
}: {
  matches: MatchWithBet[];
  poolId: string;
}) {
  const groups = useMemo(() => groupMatchesByGroup(matches), [matches]);
  const groupKeys = useMemo(() => Object.keys(groups), [groups]);

  // Grupo selecionado (default: primeiro grupo com jogos) e estado do accordion.
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState(true);
  const active = selected && groups[selected] ? selected : (groupKeys[0] ?? null);

  const tabsRef = useRef<HTMLDivElement>(null);

  // Estado de overflow do scroll (controla setas e gradientes de fade).
  const [edges, setEdges] = useState({ left: false, right: false });

  const updateEdges = useCallback(() => {
    const el = tabsRef.current;
    if (!el) return;
    const left = el.scrollLeft > 1;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setEdges((prev) => (prev.left === left && prev.right === right ? prev : { left, right }));
  }, []);

  useEffect(() => {
    updateEdges();
    const el = tabsRef.current;
    if (!el) return;
    window.addEventListener("resize", updateEdges);
    return () => window.removeEventListener("resize", updateEdges);
  }, [updateEdges, groupKeys.length]);

  const scrollByDir = useCallback((dir: 1 | -1) => {
    const el = tabsRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  }, []);

  const pick = useCallback((g: string) => {
    setSelected(g);
    setOpen(true);
  }, []);

  // Navegação por teclado entre os grupos (setas ←/→, Home/End).
  const onTabsKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!active) return;
      const i = groupKeys.indexOf(active);
      let next = i;
      if (e.key === "ArrowRight") next = (i + 1) % groupKeys.length;
      else if (e.key === "ArrowLeft") next = (i - 1 + groupKeys.length) % groupKeys.length;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = groupKeys.length - 1;
      else return;
      e.preventDefault();
      const g = groupKeys[next];
      pick(g);
      tabsRef.current
        ?.querySelector<HTMLButtonElement>(`#grp-tab-${g}`)
        ?.focus();
    },
    [active, groupKeys, pick],
  );

  if (groupKeys.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card py-10 text-center text-sm text-muted-foreground">
        Nenhum jogo de fase de grupos disponível ainda.
      </div>
    );
  }

  const activeMatches = active ? groups[active] : [];

  return (
    <div className="space-y-4">
      {/* Seletor horizontal de grupos: setas (desktop) + fade + scroll/swipe */}
      <div className="relative">
        {/* Fade + seta esquerda */}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-background to-transparent transition-opacity",
            edges.left ? "opacity-100" : "opacity-0",
          )}
        />
        <button
          type="button"
          aria-label="Grupos anteriores"
          tabIndex={-1}
          onClick={() => scrollByDir(-1)}
          className={cn(
            "absolute left-0 top-1/2 z-20 hidden -translate-y-1/2 rounded-full border border-border bg-card p-1.5 shadow-md transition-opacity hover:bg-secondary sm:flex",
            edges.left ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div
          ref={tabsRef}
          role="tablist"
          aria-label="Grupos da Copa"
          onKeyDown={onTabsKeyDown}
          onScroll={updateEdges}
          className="flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-px-1 px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {groupKeys.map((g) => {
            const ms = groups[g];
            const done = ms.filter((m) => m.bet).length;
            const isActive = g === active;
            return (
              <button
                key={g}
                id={`grp-tab-${g}`}
                role="tab"
                type="button"
                aria-selected={isActive}
                aria-controls="grp-panel"
                tabIndex={isActive ? 0 : -1}
                onClick={() => pick(g)}
                className={cn(
                  "flex min-w-[120px] shrink-0 snap-start flex-col gap-2 rounded-2xl border p-3 text-left transition-colors",
                  isActive
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:border-primary/40",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">Grupo {g}</span>
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                      done === ms.length
                        ? "bg-primary/20 text-primary"
                        : "bg-secondary text-muted-foreground",
                    )}
                  >
                    {done}/{ms.length}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {groupTeams(ms).map((t) => (
                    <Flag key={t.name} countryCode={t.countryCode} name={t.name} size={22} />
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        {/* Fade + seta direita */}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-background to-transparent transition-opacity",
            edges.right ? "opacity-100" : "opacity-0",
          )}
        />
        <button
          type="button"
          aria-label="Próximos grupos"
          tabIndex={-1}
          onClick={() => scrollByDir(1)}
          className={cn(
            "absolute right-0 top-1/2 z-20 hidden -translate-y-1/2 rounded-full border border-border bg-card p-1.5 shadow-md transition-opacity hover:bg-secondary sm:flex",
            edges.right ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Accordion do grupo selecionado (um por vez) */}
      {active && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <button
            type="button"
            id="grp-header"
            aria-expanded={open}
            aria-controls="grp-panel"
            onClick={() => setOpen((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <span className="text-sm font-bold">
              Grupo {active}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {activeMatches.length} jogos
              </span>
            </span>
            <ChevronDown
              className={cn(
                "h-5 w-5 text-muted-foreground transition-transform",
                open && "rotate-180",
              )}
            />
          </button>

          <div
            id="grp-panel"
            role="region"
            aria-labelledby="grp-header"
            hidden={!open}
            className="space-y-3 border-t border-border p-4"
          >
            {activeMatches.map((m) => (
              <MatchCard key={m.id} match={m} poolId={poolId} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
