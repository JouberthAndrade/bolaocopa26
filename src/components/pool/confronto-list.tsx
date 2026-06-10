"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { Target, Trophy, X, Users, ChevronRight } from "lucide-react";
import { Flag } from "@/components/flag";
import { Dialog } from "@/components/ui/dialog";
import { STAGE_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { loadMatchupDetail } from "@/server/actions/matchups";
import type { ConfrontoMatch, MatchupDetail } from "@/server/services/matchups";
import type { MatchupRow } from "@/lib/matchup";
import type { MatchStage } from "@prisma/client";

export function ConfrontoList({
  poolId,
  matches,
}: {
  poolId: string;
  matches: ConfrontoMatch[];
}) {
  const [open, setOpen] = useState<ConfrontoMatch | null>(null);
  const [detail, setDetail] = useState<MatchupDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function openMatch(m: ConfrontoMatch) {
    setOpen(m);
    setDetail(null);
    setError(null);
    startTransition(async () => {
      const res = await loadMatchupDetail(poolId, m.id);
      if (res.ok) setDetail(res.data);
      else setError(res.error);
    });
  }

  if (matches.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        Nenhum jogo encerrado ainda — volte quando a bola rolar. ⚽
      </p>
    );
  }

  return (
    <>
      <ul className="space-y-2">
        {matches.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              onClick={() => openMatch(m)}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-secondary/40"
            >
              <div className="min-w-0 flex-1">
                <p className="mb-1 text-xs text-muted-foreground">
                  {STAGE_LABEL[m.stage as MatchStage]}
                  {m.group ? ` · Grupo ${m.group}` : ""}
                </p>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Flag countryCode={m.home.countryCode} name={m.home.name} size={22} />
                  <span className="truncate">{m.home.name}</span>
                  <span className="mx-1 shrink-0 tabular-nums text-foreground">
                    {m.homeScore} <span className="text-muted-foreground">×</span> {m.awayScore}
                  </span>
                  <span className="truncate">{m.away.name}</span>
                  <Flag countryCode={m.away.countryCode} name={m.away.name} size={22} />
                </div>
              </div>
              <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                {m.betsCount}
                <ChevronRight className="h-4 w-4" />
              </span>
            </button>
          </li>
        ))}
      </ul>

      <Dialog
        open={open !== null}
        onClose={() => setOpen(null)}
        title={open ? `${open.home.name} ${open.homeScore} × ${open.awayScore} ${open.away.name}` : ""}
        description="Palpites dos participantes"
      >
        {pending && (
          <p className="py-6 text-center text-sm text-muted-foreground">Carregando palpites…</p>
        )}
        {error && !pending && (
          <p className="py-6 text-center text-sm text-destructive">{error}</p>
        )}
        {detail && !pending && <MatchupRows rows={detail.rows} />}
      </Dialog>
    </>
  );
}

function MatchupRows({ rows }: { rows: MatchupRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem participantes.</p>;
  }
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li
          key={r.userId}
          className={cn(
            "flex items-center gap-3 rounded-lg border p-2.5",
            r.guess === null ? "border-border bg-card opacity-60" : "border-border bg-card",
          )}
        >
          {r.image ? (
            <Image
              src={r.image}
              alt={r.name ?? ""}
              width={32}
              height={32}
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
              {(r.name ?? "?").charAt(0).toUpperCase()}
            </div>
          )}

          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {r.name ?? "Anônimo"}
          </span>

          {r.guess === null ? (
            <span className="text-xs text-muted-foreground">Não palpitou</span>
          ) : (
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-secondary px-2 py-0.5 text-sm font-semibold tabular-nums">
                {r.guess.home} × {r.guess.away}
              </span>
              <ResultBadge row={r} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function ResultBadge({ row }: { row: MatchupRow }) {
  if (!row.result) return null;
  const scored = row.result.kind === "EXACT" || row.result.kind === "RESULT";
  const Icon = row.result.kind === "EXACT" ? Target : scored ? Trophy : X;
  return (
    <span
      className={cn(
        "flex w-14 items-center justify-end gap-1 text-xs font-semibold tabular-nums",
        scored ? "text-primary" : "text-destructive",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {scored ? `+${row.points}` : "0"}
    </span>
  );
}
