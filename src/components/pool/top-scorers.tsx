"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Goal, RotateCw } from "lucide-react";
import { Flag } from "@/components/flag";
import { teamCode } from "@/lib/team-name";
import { countryNamePtBR } from "@/lib/country-codes";
import { cn } from "@/lib/utils";
import type { TopScorerRow, TopScorersPayload } from "@/server/services/top-scorers";

const MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

function formatSync(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TopScorers() {
  const [payload, setPayload] = useState<TopScorersPayload | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    let active = true;
    setError(false);
    setPayload(null);
    fetch("/api/top-scorers", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("fetch failed");
        return r.json() as Promise<TopScorersPayload>;
      })
      .then((data) => {
        if (active) setPayload(data);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => load(), [load]);

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Goal className="h-5 w-5 text-primary" />
            Artilharia da Copa
          </h2>
          <p className="text-xs text-muted-foreground">
            Top marcadores · Copa do Mundo 2026
          </p>
        </div>
        {payload?.lastSync && (
          <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-[11px] text-muted-foreground">
            Atualizado {formatSync(payload.lastSync)}
          </span>
        )}
      </header>

      {error ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-6 text-center">
          <p className="text-sm text-destructive">
            Não foi possível carregar a artilharia.
          </p>
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <RotateCw className="h-4 w-4" aria-hidden />
            Tentar novamente
          </button>
        </div>
      ) : payload === null ? (
        <ScorersSkeleton />
      ) : payload.data.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Artilharia será atualizada após os primeiros jogos ⚽
        </p>
      ) : (
        <ul className="space-y-2">
          {payload.data.map((row) => (
            <ScorerRow key={row.id} row={row} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ScorerRow({ row }: { row: TopScorerRow }) {
  const medal = MEDALS[row.position];
  // ESPN devolve o nome da seleção em inglês ("Sweden"); aqui resolvemos para o
  // ISO (bandeira via flagcdn) e para o nome em PT-BR ("Suécia"), pra bater com
  // o resto do bolão. Sem match, cai no nome original.
  const iso = teamCode(row.teamName);
  const teamLabel = (iso && countryNamePtBR(iso)) || row.teamName;
  return (
    <li className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
      {/* Posição / medalha */}
      <span className="w-7 shrink-0 text-center text-sm font-bold tabular-nums">
        {medal ?? row.position}
      </span>

      {/* Foto do jogador */}
      {row.playerPhoto ? (
        <Image
          src={row.playerPhoto}
          alt={row.playerName}
          width={40}
          height={40}
          unoptimized
          className="h-10 w-10 shrink-0 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold">
          {row.playerName.charAt(0).toUpperCase()}
        </div>
      )}

      {/* Nome + time */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{row.playerName}</p>
        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          {iso && <Flag countryCode={iso} name={teamLabel} size={18} />}
          <span className="truncate">{teamLabel}</span>
        </span>
      </div>

      {/* Gols + Assistências */}
      <div className="flex shrink-0 items-center gap-3 text-right">
        <Stat value={row.goals} label="G" className="text-primary" />
        <Stat value={row.assists} label="A" className="text-amber-500 dark:text-amber-400" />
      </div>
    </li>
  );
}

function Stat({
  value,
  label,
  className,
}: {
  value: number;
  label: string;
  className?: string;
}) {
  return (
    <div className="w-7">
      <p className={cn("text-base font-bold tabular-nums leading-none", className)}>
        {value}
      </p>
      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function ScorersSkeleton() {
  return (
    <ul className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <li
          key={i}
          className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
        >
          <div className="h-5 w-7 shrink-0 animate-pulse rounded bg-secondary" />
          <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-secondary" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-1/2 animate-pulse rounded bg-secondary" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-secondary" />
          </div>
          <div className="h-8 w-16 shrink-0 animate-pulse rounded bg-secondary" />
        </li>
      ))}
    </ul>
  );
}
