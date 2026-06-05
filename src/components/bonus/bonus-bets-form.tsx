"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
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
  const selected = teams.find((t) => t.id === value);
  return (
    <label className="block space-y-1.5">
      <span className="flex items-center justify-between text-sm font-medium">
        {label}
        <span className="text-xs text-primary">+{bonus} pts</span>
      </span>
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl border border-input bg-secondary/80 px-3",
          "focus-within:border-primary focus-within:ring-2 focus-within:ring-ring",
        )}
      >
        {selected && (
          <Flag countryCode={selected.countryCode} name={selected.name} size={22} />
        )}
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 flex-1 bg-transparent text-sm focus:outline-none [color-scheme:light] dark:[color-scheme:dark]"
        >
          <option value="">Selecione a seleção…</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}
