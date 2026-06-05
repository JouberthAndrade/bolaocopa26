"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Flag } from "@/components/flag";
import { Button } from "@/components/ui/button";
import { upsertChampionBet } from "@/server/actions/bets";
import { cn } from "@/lib/utils";
import type { BonusItem } from "@/server/services/bonus";

interface Team {
  id: string;
  name: string;
  countryCode: string;
}

export function BonusBetsForm({
  poolId,
  teams,
  items,
  current,
  onSaved,
}: {
  poolId: string;
  teams: Team[];
  items: BonusItem[];
  current: {
    champTeamId: string | null;
    runnerUpTeamId: string | null;
    topScorerName: string | null;
  };
  onSaved?: () => void;
}) {
  const has = (key: BonusItem["key"]) => items.some((i) => i.key === key);

  const [champTeamId, setChampTeamId] = useState(current.champTeamId ?? "");
  const [runnerUpTeamId, setRunnerUpTeamId] = useState(current.runnerUpTeamId ?? "");
  const [topScorerName, setTopScorerName] = useState(current.topScorerName ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function save() {
    setState("saving");
    setError(null);
    startTransition(async () => {
      const res = await upsertChampionBet({
        poolId,
        champTeamId: has("champion") ? champTeamId || undefined : undefined,
        runnerUpTeamId: has("runnerUp") ? runnerUpTeamId || undefined : undefined,
        topScorerName: has("topScorer") ? topScorerName.trim() || undefined : undefined,
      });
      if (res.ok) {
        setState("saved");
        onSaved?.();
        setTimeout(() => setState("idle"), 1500);
      } else {
        setState("error");
        setError(res.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      {has("champion") && (
        <TeamSelect
          label="Campeão 🏆"
          bonus={items.find((i) => i.key === "champion")!.bonus}
          teams={teams}
          value={champTeamId}
          onChange={setChampTeamId}
        />
      )}

      {has("runnerUp") && (
        <TeamSelect
          label="Vice-campeão 🥈"
          bonus={items.find((i) => i.key === "runnerUp")!.bonus}
          teams={teams}
          value={runnerUpTeamId}
          onChange={setRunnerUpTeamId}
        />
      )}

      {has("topScorer") && (
        <label className="block space-y-1.5">
          <span className="flex items-center justify-between text-sm font-medium">
            Artilheiro ⚽
            <span className="text-xs text-primary">
              +{items.find((i) => i.key === "topScorer")!.bonus} pts
            </span>
          </span>
          <input
            value={topScorerName}
            onChange={(e) => setTopScorerName(e.target.value)}
            placeholder="Nome do jogador"
            maxLength={80}
            className="h-11 w-full rounded-xl border border-input bg-secondary/80 px-3 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button onClick={save} disabled={state === "saving"} className="w-full">
        {state === "saving" ? (
          "Salvando…"
        ) : state === "saved" ? (
          <span className="flex items-center gap-1.5">
            <Check className="h-4 w-4" /> Palpites salvos
          </span>
        ) : (
          "Salvar palpites"
        )}
      </Button>
    </div>
  );
}

function TeamSelect({
  label,
  bonus,
  teams,
  value,
  onChange,
}: {
  label: string;
  bonus: number;
  teams: Team[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = teams.find((t) => t.id === value);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="space-y-1.5">
      <span className="flex items-center justify-between text-sm font-medium">
        {label}
        <span className="text-xs text-primary">+{bonus} pts</span>
      </span>
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "flex h-11 w-full items-center gap-2 rounded-xl border border-input bg-secondary/80 px-3 text-sm transition-colors",
            "focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            open && "border-primary ring-2 ring-ring",
          )}
        >
          {selected ? (
            <>
              <Flag countryCode={selected.countryCode} name={selected.name} size={22} />
              <span className="flex-1 text-left">{selected.name}</span>
            </>
          ) : (
            <span className="flex-1 text-left text-muted-foreground">Selecione a seleção…</span>
          )}
          <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>

        {open && (
          <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-border bg-card shadow-lg">
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false); }}
              className="flex h-9 w-full items-center px-3 text-sm text-muted-foreground hover:bg-secondary"
            >
              Selecione a seleção…
            </button>
            {teams.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => { onChange(t.id); setOpen(false); }}
                className={cn(
                  "flex h-9 w-full items-center gap-2 px-3 text-sm hover:bg-secondary",
                  t.id === value && "bg-primary/15 text-primary",
                )}
              >
                <Flag countryCode={t.countryCode} name={t.name} size={18} />
                {t.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
