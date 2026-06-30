import Link from "next/link";
import { Check, Clock, ChevronRight } from "lucide-react";
import { Flag } from "@/components/flag";
import { STAGE_LABEL } from "@/lib/labels";
import type { getUpcomingMatchesWithBets } from "@/server/services/matches";

type UpcomingMatch = Awaited<ReturnType<typeof getUpcomingMatchesWithBets>>[number];

function formatKickoff(date: Date) {
  const d = new Date(date);
  const day = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${day} · ${time}`;
}

/** Lista compacta dos próximos jogos com indicação de palpite feito/pendente. */
export function NextMatches({
  matches,
  poolSlug,
}: {
  matches: UpcomingMatch[];
  poolSlug: string;
}) {
  if (matches.length === 0) return null;

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Próximos jogos</h2>
        <Link
          href={`/jogos?pool=${poolSlug}`}
          className="flex items-center gap-0.5 text-sm font-medium text-primary hover:underline"
        >
          Ver todos
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {matches.map((m) => (
          <li key={m.id}>
            <Link
              href={`/jogos?pool=${poolSlug}`}
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary/40"
            >
              <span className="flex flex-1 items-center justify-end gap-2 text-right">
                <span className="truncate text-sm font-medium">{m.home.name}</span>
                <Flag countryCode={m.home.countryCode} name={m.home.name} size={22} />
              </span>

              <span className="flex flex-col items-center px-1 text-[11px] font-medium text-muted-foreground">
                <span className="text-muted-foreground/80">×</span>
                <span className="whitespace-nowrap">{formatKickoff(m.kickoffAt)}</span>
              </span>

              <span className="flex flex-1 items-center gap-2">
                <Flag countryCode={m.away.countryCode} name={m.away.name} size={22} />
                <span className="truncate text-sm font-medium">{m.away.name}</span>
              </span>
            </Link>

            <div className="flex items-center justify-between gap-2 px-4 pb-2 text-[11px]">
              <span className="text-muted-foreground">
                {STAGE_LABEL[m.stage]}
                {m.group ? ` · Grupo ${m.group}` : ""}
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
        ))}
      </ul>
    </section>
  );
}
