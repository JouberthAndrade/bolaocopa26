"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  Trophy,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  CalendarRange,
  ListOrdered,
  Crown,
  Bot,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { STAGE_LABEL } from "@/lib/labels";
import type { RaceData, RaceMatch, RaceParticipant } from "@/server/services/race";

type Mode = "round" | "day";

interface Checkpoint {
  key: string;
  label: string;
  /** índice do último jogo (inclusive) deste checkpoint em `matches` ordenados */
  cutoff: number;
}

const AVATAR_PX = 36;

export function RaceTrack({
  data,
  currentUserId,
}: {
  data: RaceData;
  currentUserId: string;
}) {
  // Jogos em ordem cronológica (o servidor já ordena, reforçamos por garantia).
  const matches = useMemo(
    () =>
      [...data.matches].sort(
        (a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime(),
      ),
    [data.matches],
  );

  // Soma acumulada por participante após cada jogo (prefix sums).
  const prefixByUser = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const p of data.participants) {
      const arr: number[] = [];
      let acc = 0;
      for (const m of matches) {
        acc += m.points[p.userId] ?? 0;
        arr.push(acc);
      }
      map.set(p.userId, arr);
    }
    return map;
  }, [data.participants, matches]);

  const rounds = useMemo(() => buildRoundCheckpoints(matches), [matches]);
  const days = useMemo(() => buildDayCheckpoints(matches), [matches]);

  const [mode, setMode] = useState<Mode>("round");
  const checkpoints = mode === "round" ? rounds : days;

  // Passo selecionado (último por padrão / ao trocar de modo).
  const [step, setStep] = useState(Math.max(0, checkpoints.length - 1));
  useEffect(() => {
    setStep(Math.max(0, checkpoints.length - 1));
  }, [mode, checkpoints.length]);

  const safeStep = Math.min(step, Math.max(0, checkpoints.length - 1));
  const current = checkpoints[safeStep];

  // Reprodução automática: avança os checkpoints como uma corrida.
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!playing) return;
    timer.current = setInterval(() => {
      setStep((s) => {
        if (s >= checkpoints.length - 1) {
          setPlaying(false);
          return s;
        }
        return s + 1;
      });
    }, 1100);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing, checkpoints.length]);

  function play() {
    if (checkpoints.length === 0) return;
    // recomeça do início se já estiver no fim
    setStep((s) => (s >= checkpoints.length - 1 ? 0 : s));
    setPlaying(true);
  }

  // Pontuação de cada participante no checkpoint atual + ordenação das raias
  // (por pontuação final, para a corrida parecer um pódio estável).
  const lanes = useMemo(() => {
    const cutoff = current?.cutoff ?? -1;
    const finalIdx = matches.length - 1;
    const rows = data.participants.map((p) => {
      const prefix = prefixByUser.get(p.userId) ?? [];
      const pts = cutoff >= 0 ? (prefix[cutoff] ?? 0) : 0;
      const total = finalIdx >= 0 ? (prefix[finalIdx] ?? 0) : 0;
      return { participant: p, pts, total };
    });
    rows.sort((a, b) => b.total - a.total || b.pts - a.pts);
    return rows;
  }, [current, data.participants, prefixByUser, matches.length]);

  const leaderPts = useMemo(
    () => lanes.reduce((mx, l) => Math.max(mx, l.pts), 0),
    [lanes],
  );

  if (matches.length === 0 || data.participants.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        <Trophy className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          A corrida pelo prêmio começa quando os primeiros jogos forem pontuados. 🏁
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <header className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="flex items-center gap-1.5 font-semibold">
            <Trophy className="h-4 w-4 text-amber-400" /> Corrida pelo prêmio
          </h3>
          <p className="truncate text-xs text-muted-foreground">
            {current?.label ?? "—"}
            {data.playerCount > 0 && (
              <> · {data.playerCount} apostadores</>
            )}
          </p>
        </div>
        <ModeToggle mode={mode} onChange={setMode} />
      </header>

      {/* Pista */}
      <div className="relative pr-16">
        {/* Linha de chegada (tesouro) */}
        <FinishLine prize={data.prizeTotal} currency={data.currency} />

        <div className="space-y-2">
          {lanes.map(({ participant, pts }) => {
            const pct = leaderPts > 0 ? pts / leaderPts : 0;
            const isLeader = pts > 0 && pts === leaderPts;
            const isMe = participant.userId === currentUserId;
            return (
              <Lane
                key={participant.userId}
                participant={participant}
                pct={pct}
                pts={pts}
                isLeader={isLeader}
                isMe={isMe}
              />
            );
          })}
        </div>
      </div>

      {/* Controles de checkpoint */}
      <Controls
        checkpoints={checkpoints}
        step={safeStep}
        playing={playing}
        onStep={(s) => {
          setPlaying(false);
          setStep(s);
        }}
        onPlayToggle={() => (playing ? setPlaying(false) : play())}
      />
    </div>
  );
}

function Lane({
  participant,
  pct,
  pts,
  isLeader,
  isMe,
}: {
  participant: RaceParticipant;
  pct: number;
  pts: number;
  isLeader: boolean;
  isMe: boolean;
}) {
  return (
    <div className="relative h-11">
      {/* raia tracejada até a chegada */}
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 border-t border-dashed border-border" />

      <div
        className="absolute top-1/2 -translate-y-1/2 transition-[left] duration-700 ease-out"
        // a viagem vai de 0 até a borda da linha de chegada, descontando o avatar
        style={{ left: `calc(${pct} * (100% - ${AVATAR_PX}px))` }}
      >
        <div className="flex flex-col items-center gap-0.5">
          <span
            className={cn(
              "rounded-full px-1.5 text-[10px] font-bold leading-tight tabular-nums",
              isLeader
                ? "bg-amber-400/20 text-amber-400"
                : isMe
                  ? "bg-primary/20 text-primary"
                  : "bg-secondary text-muted-foreground",
            )}
          >
            {pts}
          </span>
          <div className="relative">
            {isLeader && (
              <Crown className="absolute -top-2.5 left-1/2 h-3.5 w-3.5 -translate-x-1/2 fill-amber-400 text-amber-400" />
            )}
            <Avatar participant={participant} isMe={isMe} isLeader={isLeader} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Avatar({
  participant,
  isMe,
  isLeader,
}: {
  participant: RaceParticipant;
  isMe: boolean;
  isLeader: boolean;
}) {
  const ring = isLeader
    ? "ring-2 ring-amber-400"
    : isMe
      ? "ring-2 ring-primary"
      : "ring-1 ring-border";
  const cls = cn("h-9 w-9 shrink-0 rounded-full object-cover", ring);

  if (participant.isBot) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-violet-500/20 text-violet-300",
          cls,
        )}
        title={participant.name ?? "Bot"}
      >
        <Bot className="h-4 w-4" />
      </div>
    );
  }
  if (participant.image) {
    return (
      <Image
        src={participant.image}
        alt={participant.name ?? ""}
        width={AVATAR_PX}
        height={AVATAR_PX}
        className={cls}
        title={participant.name ?? ""}
      />
    );
  }
  return (
    <div
      className={cn(
        "flex items-center justify-center bg-secondary text-xs font-semibold",
        cls,
      )}
      title={participant.name ?? ""}
    >
      {(participant.name ?? "?").charAt(0).toUpperCase()}
    </div>
  );
}

function FinishLine({ prize, currency }: { prize: number; currency: string }) {
  return (
    <div className="pointer-events-none absolute inset-y-0 right-0 flex w-16 flex-col items-center justify-center gap-1">
      {/* faixa quadriculada */}
      <div
        className="absolute inset-y-1 left-0 w-1.5 rounded"
        style={{
          backgroundImage:
            "repeating-conic-gradient(#fff 0% 25%, #111 0% 50%)",
          backgroundSize: "6px 6px",
        }}
      />
      <div className="flex flex-col items-center rounded-lg border border-amber-400/40 bg-amber-400/10 px-1.5 py-1 text-center">
        <Trophy className="h-5 w-5 text-amber-400" />
        {prize > 0 && (
          <span className="mt-0.5 text-[10px] font-bold leading-tight text-amber-400">
            {formatCurrency(prize, currency)}
          </span>
        )}
      </div>
    </div>
  );
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: Mode;
  onChange: (m: Mode) => void;
}) {
  const items = [
    { key: "round" as const, label: "Rodada", Icon: ListOrdered },
    { key: "day" as const, label: "Dia", Icon: CalendarRange },
  ];
  return (
    <div className="flex shrink-0 gap-1 rounded-full border border-border bg-background p-0.5">
      {items.map(({ key, label, Icon }) => {
        const active = mode === key;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(key)}
            className={cn(
              "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

function Controls({
  checkpoints,
  step,
  playing,
  onStep,
  onPlayToggle,
}: {
  checkpoints: Checkpoint[];
  step: number;
  playing: boolean;
  onStep: (s: number) => void;
  onPlayToggle: () => void;
}) {
  const atStart = step <= 0;
  const atEnd = step >= checkpoints.length - 1;
  const arrow =
    "rounded-full border border-border bg-background p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:pointer-events-none disabled:opacity-40";

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onPlayToggle}
        aria-label={playing ? "Pausar" : "Assistir corrida"}
        className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
      >
        {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        {playing ? "Pausar" : "Assistir"}
      </button>

      <button
        type="button"
        aria-label="Anterior"
        disabled={atStart}
        onClick={() => onStep(step - 1)}
        className={arrow}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {/* trilha de progresso clicável */}
      <input
        type="range"
        min={0}
        max={Math.max(0, checkpoints.length - 1)}
        value={step}
        onChange={(e) => onStep(Number(e.target.value))}
        aria-label="Checkpoint da corrida"
        className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-secondary accent-primary"
      />

      <button
        type="button"
        aria-label="Próximo"
        disabled={atEnd}
        onClick={() => onStep(step + 1)}
        className={arrow}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─────────────────────────── checkpoints ───────────────────────────

/** Um checkpoint por rodada/fase, em ordem cronológica. */
function buildRoundCheckpoints(matches: RaceMatch[]): Checkpoint[] {
  const order: string[] = [];
  const lastIdx = new Map<string, number>();
  matches.forEach((m, i) => {
    const key = m.stage === "GROUP" ? `g${m.matchday ?? 0}` : m.stage;
    if (!lastIdx.has(key)) order.push(key);
    lastIdx.set(key, i);
  });
  return order.map((key) => ({
    key,
    label: roundLabel(key, matches[lastIdx.get(key)!]),
    cutoff: lastIdx.get(key)!,
  }));
}

function roundLabel(key: string, m: RaceMatch): string {
  if (key.startsWith("g")) return `Rodada ${key.slice(1)}`;
  return STAGE_LABEL[m.stage];
}

/** Um checkpoint por dia (fuso local), em ordem cronológica. */
function buildDayCheckpoints(matches: RaceMatch[]): Checkpoint[] {
  const order: string[] = [];
  const lastIdx = new Map<string, number>();
  const firstDate = new Map<string, Date>();
  matches.forEach((m, i) => {
    const d = new Date(m.kickoffAt);
    const key = d.toLocaleDateString("pt-BR");
    if (!lastIdx.has(key)) {
      order.push(key);
      firstDate.set(key, d);
    }
    lastIdx.set(key, i);
  });
  return order.map((key) => ({
    key,
    label: dayLabel(firstDate.get(key)!),
    cutoff: lastIdx.get(key)!,
  }));
}

/** "Hoje" / "Ontem" / "sex., 12/06". */
function dayLabel(date: Date): string {
  const startOf = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((startOf(date) - startOf(new Date())) / 86_400_000);
  if (diff === 0) return "Hoje";
  if (diff === -1) return "Ontem";
  if (diff === 1) return "Amanhã";
  return date.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}
