"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import {
  Trophy,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  CalendarRange,
  ListOrdered,
  Swords,
  Crown,
  Bot,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { buildCheckpoints, type Checkpoint, type RaceMode } from "@/lib/race-checkpoints";
import type { RaceData, RaceParticipant } from "@/server/services/race";

const AVATAR_PX = 36;

// Como o modo de agrupamento divide a corrida — usado na dica e nos títulos.
const MODE_HINT: Record<RaceMode, string> = {
  round: "rodada",
  day: "dia",
  game: "jogo a jogo",
};

export function RaceTrack({
  data,
  currentUserId,
}: {
  data: RaceData;
  currentUserId: string;
}) {
  const reduce = useReducedMotion();

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

  const [mode, setMode] = useState<RaceMode>("round");
  const checkpoints = useMemo(() => buildCheckpoints(mode, matches), [mode, matches]);

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

  // Largura da pista (para mover os avatares por translateX em px — mais suave que `left`).
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackW, setTrackW] = useState(0);
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const update = () => setTrackW(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Pontuação de cada participante NO checkpoint atual + ordenação das raias pela
  // pontuação atual (ultrapassagens reais — os avatares sobem e descem). Desempate
  // estável por userId para evitar tremor quando há empate.
  const lanes = useMemo(() => {
    const cutoff = current?.cutoff ?? -1;
    const rows = data.participants.map((p) => {
      const prefix = prefixByUser.get(p.userId) ?? [];
      const pts = cutoff >= 0 ? (prefix[cutoff] ?? 0) : 0;
      return { participant: p, pts };
    });
    rows.sort(
      (a, b) => b.pts - a.pts || a.participant.userId.localeCompare(b.participant.userId),
    );
    return rows;
  }, [current, data.participants, prefixByUser]);

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
            {data.playerCount > 0 && <> · {data.playerCount} apostadores</>}
          </p>
        </div>
        <ModeToggle mode={mode} onChange={setMode} />
      </header>

      {/* Pista */}
      <div className="relative pr-16">
        {/* Linha de chegada (tesouro) */}
        <FinishLine prize={data.prizeTotal} currency={data.currency} />

        <LayoutGroup>
          <div ref={trackRef} className="space-y-2">
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
                  trackW={trackW}
                  reduce={!!reduce}
                />
              );
            })}
          </div>
        </LayoutGroup>
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

      <p className="text-center text-[11px] leading-snug text-muted-foreground">
        Toque <span className="font-semibold text-foreground">Assistir</span> para
        ver a corrida evoluir — ou arraste a linha para avançar por{" "}
        {MODE_HINT[mode]}.
      </p>
    </div>
  );
}

function Lane({
  participant,
  pct,
  pts,
  isLeader,
  isMe,
  trackW,
  reduce,
}: {
  participant: RaceParticipant;
  pct: number;
  pts: number;
  isLeader: boolean;
  isMe: boolean;
  trackW: number;
  reduce: boolean;
}) {
  // a viagem vai de 0 até a borda da linha de chegada, descontando o avatar
  const x = pct * Math.max(0, trackW - AVATAR_PX);
  const spring = reduce
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 140, damping: 22, mass: 0.6 };

  return (
    <motion.div
      layout={reduce ? false : "position"}
      transition={spring}
      className="relative h-11"
    >
      {/* raia tracejada até a chegada */}
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 border-t border-dashed border-border" />

      <motion.div
        className="absolute left-0"
        initial={false}
        style={{ top: "50%", y: "-50%" }}
        animate={{ x }}
        transition={spring}
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
      </motion.div>
    </motion.div>
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
          backgroundImage: "repeating-conic-gradient(#fff 0% 25%, #111 0% 50%)",
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
  mode: RaceMode;
  onChange: (m: RaceMode) => void;
}) {
  const items = [
    { key: "round" as const, label: "Rodada", Icon: ListOrdered, title: "Agrupar a corrida por rodada" },
    { key: "day" as const, label: "Dia", Icon: CalendarRange, title: "Agrupar a corrida por dia" },
    { key: "game" as const, label: "Jogo", Icon: Swords, title: "Avançar a corrida jogo a jogo" },
  ];
  return (
    <div
      role="group"
      aria-label="Agrupar a corrida por"
      className="flex shrink-0 gap-1 rounded-full border border-border bg-background p-0.5"
    >
      {items.map(({ key, label, Icon, title }) => {
        const active = mode === key;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={active}
            title={title}
            onClick={() => onChange(key)}
            className={cn(
              "flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
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
  // Alvos de toque ≥44px (min-h/w-11) para o polegar no celular.
  const arrow =
    "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-40";

  // Thumb do slider grande o bastante para arrastar no toque.
  const rangeThumb =
    "[&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow " +
    "[&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-background [&::-moz-range-thumb]:bg-primary";

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onPlayToggle}
        aria-label={playing ? "Pausar" : "Assistir corrida"}
        className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card"
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        {playing ? "Pausar" : "Assistir"}
      </button>

      <button
        type="button"
        aria-label="Checkpoint anterior"
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
        className={cn(
          "h-2 flex-1 cursor-pointer appearance-none rounded-full bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
          rangeThumb,
        )}
      />

      <button
        type="button"
        aria-label="Próximo checkpoint"
        disabled={atEnd}
        onClick={() => onStep(step + 1)}
        className={arrow}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
