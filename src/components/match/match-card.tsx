"use client";

import { useState, useTransition, useCallback, useRef } from "react";
import { Lock, Check, Clock, Wifi, Target, Trophy, X } from "lucide-react";
import { Flag } from "@/components/flag";
import { upsertBet } from "@/server/actions/bets";
import { STAGE_LABEL } from "@/lib/labels";
import { isBettable, cn } from "@/lib/utils";
import { classifyBet } from "@/lib/bet-result";
import type { MatchWithBet } from "@/server/services/matches";
import type { Advance } from "@prisma/client";

type SaveState = "idle" | "saving" | "saved" | "error";

export function MatchCard({ match, poolId }: { match: MatchWithBet; poolId: string }) {
  const locked = !isBettable(match.lockAt) || match.status !== "SCHEDULED";
  const isLive = match.status === "LIVE";
  const isFinished = match.status === "FINISHED";

  const [home, setHome] = useState<string>(match.bet?.homeGuess?.toString() ?? "");
  const [away, setAway] = useState<string>(match.bet?.awayGuess?.toString() ?? "");
  const [advances, setAdvances] = useState<Advance | "">(match.bet?.advances ?? "");
  const isKnockout = match.stage !== "GROUP";
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const save = useCallback(
    (h: string, a: string, adv: Advance | "") => {
      if (h === "" || a === "") return;
      const knockoutDraw = isKnockout && h === a;
      // Empate de mata-mata sem escolha de quem avança: não salva ainda.
      if (knockoutDraw && adv === "") {
        setSaveState("idle");
        return;
      }
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setSaveState("saving");
        startTransition(async () => {
          const res = await upsertBet({
            poolId,
            matchId: match.id,
            homeGuess: Number(h),
            awayGuess: Number(a),
            advances: knockoutDraw ? adv : undefined,
          });
          setSaveState(res.ok ? "saved" : "error");
          if (res.ok) setTimeout(() => setSaveState("idle"), 2000);
        });
      }, 600);
    },
    [match.id, poolId, isKnockout],
  );

  const kickoff = new Date(match.kickoffAt);
  const timeStr = kickoff.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const dateStr = kickoff.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const lockAt = new Date(match.lockAt);
  const lockTimeStr = lockAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border bg-card transition-all",
        isLive
          ? "border-primary/60 shadow-[0_0_16px_2px_hsl(142_71%_45%/0.15)]"
          : "border-border",
      )}
    >
      {/* Cabeçalho da partida */}
      <div
        className={cn(
          "flex items-center justify-between px-4 py-2 text-xs font-medium",
          isLive
            ? "bg-primary/15 text-primary"
            : isFinished
              ? "bg-secondary/40 text-muted-foreground"
              : "bg-secondary/30 text-muted-foreground",
        )}
      >
        <span>
          {STAGE_LABEL[match.stage]}
          {match.group ? ` · Grupo ${match.group}` : ""}
        </span>
        <span className="flex items-center gap-1.5">
          {isLive ? (
            <>
              <Wifi className="h-3 w-3 animate-pulse" />
              AO VIVO
            </>
          ) : locked ? (
            <>
              <Lock className="h-3 w-3" />
              {isFinished ? "Encerrado" : "Fechado"}
            </>
          ) : (
            <>
              <Clock className="h-3 w-3" />
              {dateStr} · {timeStr}
            </>
          )}
        </span>
      </div>

      {/* Corpo: bandeiras + placar */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-4">
        {/* Mandante */}
        <div className="flex flex-col items-center gap-2">
          <Flag countryCode={match.home.countryCode} name={match.home.name} size={52} />
          <span className="text-center text-sm font-semibold leading-tight">
            {match.home.name}
          </span>
        </div>

        {/* Centro: palpite / placar oficial */}
        <div className="flex flex-col items-center gap-1 px-2">
          {isFinished || isLive ? (
            /* Placar oficial */
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold tabular-nums">
                {match.homeScore ?? "–"}
              </span>
              <span className="text-xl text-muted-foreground">×</span>
              <span className="text-3xl font-bold tabular-nums">
                {match.awayScore ?? "–"}
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-1.5">
                <ScoreInput
                  value={home}
                  disabled={locked}
                  onChange={(v) => {
                    setHome(v);
                    const nextAdv = isKnockout && v !== "" && v === away ? advances : "";
                    setAdvances(nextAdv);
                    save(v, away, nextAdv);
                  }}
                />
                <span className="text-lg font-light text-muted-foreground">×</span>
                <ScoreInput
                  value={away}
                  disabled={locked}
                  onChange={(v) => {
                    setAway(v);
                    const nextAdv = isKnockout && v !== "" && v === home ? advances : "";
                    setAdvances(nextAdv);
                    save(home, v, nextAdv);
                  }}
                />
              </div>

              {!locked && isKnockout && home !== "" && away !== "" && home === away && (
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                    Quem avança nos pênaltis?
                  </span>
                  <div className="flex gap-2">
                    <AdvanceButton
                      selected={advances === "HOME"}
                      name={match.home.name}
                      countryCode={match.home.countryCode}
                      onClick={() => { setAdvances("HOME"); save(home, away, "HOME"); }}
                    />
                    <AdvanceButton
                      selected={advances === "AWAY"}
                      name={match.away.name}
                      countryCode={match.away.countryCode}
                      onClick={() => { setAdvances("AWAY"); save(home, away, "AWAY"); }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Meu palpite + resultado oficial (exibe depois de fechar) */}
          {(locked || isFinished) && match.bet && (
            <div className="mt-1 flex flex-col items-center gap-1">
              <div className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
                Meu palpite: {match.bet.homeGuess} × {match.bet.awayGuess}
              </div>
              {match.bet.advances && (
                <div className="flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  <Flag
                    countryCode={
                      match.bet.advances === "HOME"
                        ? match.home.countryCode
                        : match.away.countryCode
                    }
                    name={match.bet.advances === "HOME" ? match.home.name : match.away.name}
                    size={14}
                  />
                  <span>
                    {match.bet.advances === "HOME" ? match.home.name : match.away.name} nos
                    pênaltis
                  </span>
                </div>
              )}
              {isFinished && (
                <ResultBadge match={match} />
              )}
            </div>
          )}

          {/* Horário de fechamento dos palpites */}
          {!locked && (
            <p className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
              <Clock className="h-3 w-3" />
              Fecha às {lockTimeStr}
            </p>
          )}

          {/* Status do autosave */}
          {!locked &&
            (isKnockout && home !== "" && away !== "" && home === away && advances === "" ? (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Escolha quem avança nos pênaltis
              </p>
            ) : (
              <SaveBadge state={saveState} hasBet={!!match.bet} />
            ))}
        </div>

        {/* Visitante */}
        <div className="flex flex-col items-center gap-2">
          <Flag countryCode={match.away.countryCode} name={match.away.name} size={52} />
          <span className="text-center text-sm font-semibold leading-tight">
            {match.away.name}
          </span>
        </div>
      </div>

      {/* Rodapé */}
      {match.venue && (
        <div className="border-t border-border px-4 py-1.5 text-center text-xs text-muted-foreground">
          {match.venue}
        </div>
      )}
    </div>
  );
}

/**
 * Badge de conferência exibido abaixo do palpite, em jogos finalizados.
 * Verde para acertos (placar exato / vencedor / empate) com a pontuação ganha;
 * vermelho quando o palpite não pontuou. O "tipo" do acerto é derivado no
 * client (puro), e os pontos vêm de bet.pointsEarned (calculado no servidor).
 */
function ResultBadge({ match }: { match: MatchWithBet }) {
  if (!match.bet) return null;
  const result = classifyBet(
    { home: match.bet.homeGuess, away: match.bet.awayGuess },
    { home: match.homeScore, away: match.awayScore, finished: true },
  );
  const points = match.bet.pointsEarned ?? 0;
  const scored = result.kind === "EXACT" || result.kind === "RESULT";

  const Icon = result.kind === "EXACT" ? Target : scored ? Trophy : X;

  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
        scored
          ? "bg-primary/15 text-primary"
          : "bg-destructive/15 text-destructive",
      )}
    >
      <Icon className="h-3 w-3" />
      <span>{scored ? `✅ ${result.label}` : `❌ ${result.label}`}</span>
      <span className="ml-0.5 tabular-nums">
        {scored ? `+${points} pts` : "0 pts"}
      </span>
    </div>
  );
}

function ScoreInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      max={99}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 2))}
      placeholder="–"
      className={cn(
        "h-14 w-14 rounded-xl border border-input bg-secondary/80 text-center text-2xl font-bold tabular-nums transition-colors focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        disabled && "cursor-not-allowed opacity-50",
      )}
    />
  );
}

function SaveBadge({ state, hasBet }: { state: SaveState; hasBet: boolean }) {
  if (state === "saving")
    return <p className="text-xs text-muted-foreground">Salvando…</p>;
  if (state === "saved")
    return (
      <p className="flex items-center gap-1 text-xs text-primary">
        <Check className="h-3 w-3" /> Salvo
      </p>
    );
  if (state === "error")
    return <p className="text-xs text-destructive">Erro ao salvar</p>;
  if (hasBet)
    return (
      <p className="flex items-center gap-1 text-xs text-primary">
        <Check className="h-3 w-3" /> Palpite registrado
      </p>
    );
  return <p className="text-xs text-muted-foreground">Digite seu palpite</p>;
}

function AdvanceButton({
  selected,
  name,
  countryCode,
  onClick,
}: {
  selected: boolean;
  name: string;
  countryCode: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors",
        selected
          ? "border-primary bg-primary/15 text-primary"
          : "border-input bg-secondary/60 text-muted-foreground hover:text-foreground",
      )}
    >
      <Flag countryCode={countryCode} name={name} size={16} />
      <span>{name}</span>
    </button>
  );
}
