import Link from "next/link";
import { Check, Clock, ChevronRight, Wifi } from "lucide-react";
import { Flag } from "@/components/flag";
import { STAGE_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { getTodayMatchesWithBets } from "@/server/services/matches";

type TodayMatch = Awaited<ReturnType<typeof getTodayMatchesWithBets>>[number];

function formatTime(date: Date) {
  return new Date(date).toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Jogos do dia atual com indicação de palpite, placar ao vivo/encerrado. */
export function TodayMatches({
  matches,
  poolSlug,
}: {
  matches: TodayMatch[];
  poolSlug: string;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Jogos do dia</h2>
        <Link
          href={`/jogos?pool=${poolSlug}`}
          className="flex items-center gap-0.5 text-sm font-medium text-primary hover:underline"
        >
          Ver todos
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {matches.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
          Nenhum jogo hoje.
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {matches.map((m) => {
            const isLive = m.status === "LIVE";
            const isFinished = m.status === "FINISHED";
            const hasScore = (isLive || isFinished) && m.homeScore != null && m.awayScore != null;
            return (
              <li key={m.id}>
                <Link
                  href={`/jogos?pool=${poolSlug}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary/40"
                >
                  <span className="flex flex-1 items-center justify-end gap-2 text-right">
                    <span className="truncate text-sm font-medium">{m.home.name}</span>
                    <Flag countryCode={m.home.countryCode} name={m.home.name} size={22} />
                  </span>

                  <span className="flex min-w-14 flex-col items-center px-1 text-center">
                    {hasScore ? (
                      <span className="text-base font-bold tabular-nums">
                        {m.homeScore} <span className="text-muted-foreground">×</span> {m.awayScore}
                      </span>
                    ) : (
                      <>
                        <span className="text-[11px] text-muted-foreground/80">×</span>
                        <span className="whitespace-nowrap text-[11px] font-medium text-muted-foreground">
                          {formatTime(m.kickoffAt)}
                        </span>
                      </>
                    )}
                  </span>

                  <span className="flex flex-1 items-center gap-2">
                    <Flag countryCode={m.away.countryCode} name={m.away.name} size={22} />
                    <span className="truncate text-sm font-medium">{m.away.name}</span>
                  </span>
                </Link>

                <div className="flex items-center justify-between gap-2 px-4 pb-2 text-[11px]">
                  <span
                    className={cn(
                      "flex items-center gap-1",
                      isLive ? "font-semibold text-primary" : "text-muted-foreground",
                    )}
                  >
                    {isLive ? (
                      <>
                        <Wifi className="h-3 w-3 animate-pulse" />
                        AO VIVO
                      </>
                    ) : isFinished ? (
                      "Encerrado"
                    ) : (
                      <>
                        {STAGE_LABEL[m.stage]}
                        {m.group ? ` · Grupo ${m.group}` : ""}
                      </>
                    )}
                  </span>
                  {m.bet ? (
                    <span className="flex items-center gap-1 font-medium text-primary">
                      <Check className="h-3 w-3" />
                      Palpite {m.bet.homeGuess}×{m.bet.awayGuess}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400">
                      <Clock className="h-3 w-3" />
                      Sem palpite
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
