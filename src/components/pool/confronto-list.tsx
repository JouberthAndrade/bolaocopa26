"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { Target, Trophy, X, Users, ChevronRight, Bot, Wifi, Clock, RotateCw } from "lucide-react";
import { Flag } from "@/components/flag";
import { Dialog } from "@/components/ui/dialog";
import { STAGE_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { isAwaitingConfirmation } from "@/lib/bet-result";
import { loadMatchupDetail } from "@/server/actions/matchups";
import { splitBotRows, withProvisionalPoints } from "@/lib/matchup";
import type { ConfrontoMatch, MatchupDetail } from "@/server/services/matchups";
import type { MatchupRow } from "@/lib/matchup";
import type { BotKind, MatchStage } from "@prisma/client";

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
        Nenhum confronto disponível — os palpites são revelados 10 minutos antes
        de cada partida. ⚽
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
                <p className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  {STAGE_LABEL[m.stage as MatchStage]}
                  {m.group ? ` · Grupo ${m.group}` : ""}
                  {m.status === "LIVE" && (
                    <span className="flex items-center gap-1 font-semibold text-primary">
                      <Wifi className="h-3 w-3 animate-pulse" /> AO VIVO
                    </span>
                  )}
                  {m.status === "SCHEDULED" && (
                    <span className="flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                      <Clock className="h-3 w-3" /> Começa às{" "}
                      {new Date(m.kickoffAt).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </p>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Flag countryCode={m.home.countryCode} name={m.home.name} size={22} />
                  <span className="truncate">{m.home.name}</span>
                  <span className="mx-1 shrink-0 tabular-nums text-foreground">
                    {m.homeScore ?? ""} <span className="text-muted-foreground">×</span>{" "}
                    {m.awayScore ?? ""}
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
        title={
          open
            ? open.homeScore != null
              ? `${open.home.name} ${open.homeScore} × ${open.awayScore} ${open.away.name}`
              : `${open.home.name} × ${open.away.name}`
            : ""
        }
        description="Palpites dos participantes"
      >
        {pending && (
          <p className="py-6 text-center text-sm text-muted-foreground">Carregando palpites…</p>
        )}
        {error && !pending && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-sm text-destructive">{error}</p>
            {open && (
              <button
                type="button"
                onClick={() => openMatch(open)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <RotateCw className="h-4 w-4" aria-hidden />
                Tentar novamente
              </button>
            )}
          </div>
        )}
        {detail && !pending && (
          <MatchupRows
            match={detail.match}
            rows={
              // Pontua provisoriamente no client (Bet.pointsEarned só é persistido
              // pelo servidor após confirmar o resultado) enquanto o jogo está em
              // andamento OU encerrado mas ainda não pontuado. Só usa os pontos
              // persistidos quando o scoring já consolidou (scored).
              detail.match.status === "FINISHED" && detail.match.scored
                ? detail.rows
                : withProvisionalPoints(detail.rows, detail.rule)
            }
          />
        )}
      </Dialog>
    </>
  );
}

// Estilo diferenciado por bot (Claudinho roxo, Gepeto verde).
const BOT_STYLE: Record<BotKind, { card: string; avatar: string; badge: string }> = {
  CLAUDINHO: {
    card: "border-violet-500/40 bg-gradient-to-r from-violet-500/15 to-fuchsia-500/10",
    avatar: "bg-violet-500/20 text-violet-500 dark:text-violet-300",
    badge: "bg-violet-500/20 text-violet-600 dark:text-violet-200",
  },
  GEPETO: {
    card: "border-emerald-500/40 bg-gradient-to-r from-emerald-500/15 to-teal-500/10",
    avatar: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300",
    badge: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-200",
  },
};

type MatchTeams = MatchupDetail["match"];

function MatchupRows({ match, rows }: { match: MatchTeams; rows: MatchupRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem participantes.</p>;
  }
  const { bots, humans } = splitBotRows(rows);
  const awaiting = isAwaitingConfirmation(match);

  return (
    <div className="space-y-4">
      {awaiting && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-600 dark:text-amber-400">
          <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-pulse" />
          <span>
            Aguardando confirmação do resultado — os pontos abaixo são provisórios
            e serão consolidados assim que o placar for confirmado.
          </span>
        </div>
      )}

      {bots.length > 0 && (
        <section className="space-y-2">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Bot className="h-3.5 w-3.5" />
            Inteligência Artificial
          </h4>
          <ul className="space-y-2">
            {bots.map((r) => (
              <BotRow key={r.userId} row={r} match={match} />
            ))}
          </ul>
        </section>
      )}

      {humans.length > 0 && (
        <section className="space-y-2">
          {bots.length > 0 && (
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Participantes
            </h4>
          )}
          <ul className="space-y-2">
            {humans.map((r) => (
              <HumanRow key={r.userId} row={r} match={match} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/**
 * Mostra quem o participante apostou que avança nos pênaltis — só aparece em
 * palpite de empate no mata-mata (Bet.advances). A bandeira/nome vêm do time
 * da casa ou visitante conforme o pick (HOME/AWAY).
 */
function AdvanceChip({ advances, match }: { advances: MatchupRow["advances"]; match: MatchTeams }) {
  if (!advances) return null;
  const team = advances === "HOME" ? match.home : match.away;
  return (
    <span className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
      <Flag countryCode={team.countryCode} name={team.name} size={12} />
      <span className="truncate">{team.name} nos pênaltis</span>
    </span>
  );
}

function BotRow({ row, match }: { row: MatchupRow; match: MatchTeams }) {
  const style = (row.botKind && BOT_STYLE[row.botKind]) ?? BOT_STYLE.CLAUDINHO;
  return (
    <li className={cn("flex items-center gap-3 rounded-lg border p-2.5", style.card)}>
      <div className={cn("flex h-8 w-8 items-center justify-center rounded-full", style.avatar)}>
        <Bot className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold">{row.name ?? "Bot"}</span>
          <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold leading-none", style.badge)}>
            IA
          </span>
        </div>
        <AdvanceChip advances={row.advances} match={match} />
      </div>

      {row.guess === null ? (
        <span className="text-xs text-muted-foreground">Não palpitou</span>
      ) : (
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-background/60 px-2 py-0.5 text-sm font-semibold tabular-nums">
            {row.guess.home} × {row.guess.away}
          </span>
          <ResultBadge row={row} />
        </div>
      )}
    </li>
  );
}

function HumanRow({ row: r, match }: { row: MatchupRow; match: MatchTeams }) {
  return (
    <li
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

      <div className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{r.name ?? "Anônimo"}</span>
        <AdvanceChip advances={r.advances} match={match} />
      </div>

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
