import Image from "next/image";
import { Bot, Medal, Trophy } from "lucide-react";
import { Flag } from "@/components/flag";
import { cn } from "@/lib/utils";
import type { BonusMatchupRow } from "@/server/services/bonus";

/**
 * Palpites de bônus (campeão / vice / artilheiro) de todos os participantes.
 * Server component — os dados só chegam aqui depois do prazo (getBonusMatchup
 * retorna null antes), então nunca renderiza palpite ainda editável.
 */
export function BonusMatchup({ rows }: { rows: BonusMatchupRow[] }) {
  if (rows.length === 0) return null;

  return (
    <section className="rounded-2xl border border-border bg-card">
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Trophy className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Palpites de bônus</h2>
        <span className="text-xs text-muted-foreground">campeão · vice · artilheiro</span>
      </header>

      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <li key={r.userId} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5">
            {/* Participante */}
            <div className="flex w-40 min-w-0 items-center gap-2">
              {r.isBot ? (
                <div
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                    r.botKind === "GEPETO"
                      ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300"
                      : "bg-violet-500/20 text-violet-500 dark:text-violet-300",
                  )}
                >
                  <Bot className="h-4 w-4" />
                </div>
              ) : r.image ? (
                <Image
                  src={r.image}
                  alt={r.name ?? ""}
                  width={28}
                  height={28}
                  className="h-7 w-7 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                  {(r.name ?? "?").charAt(0).toUpperCase()}
                </div>
              )}
              <span className="truncate text-sm font-medium">{r.name ?? "Anônimo"}</span>
            </div>

            {/* Palpites */}
            {!r.champ && !r.runnerUp && !r.topScorer ? (
              <span className="text-xs text-muted-foreground">Não palpitou</span>
            ) : (
              <div className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <BonusPick icon="🏆" team={r.champ} />
                <BonusPick icon="🥈" team={r.runnerUp} />
                {r.topScorer && (
                  <span className="flex items-center gap-1.5">
                    <Medal className="h-3.5 w-3.5 text-amber-500" />
                    {r.topScorer}
                  </span>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function BonusPick({
  icon,
  team,
}: {
  icon: string;
  team: { name: string; countryCode: string } | null;
}) {
  if (!team) return null;
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden>{icon}</span>
      <Flag countryCode={team.countryCode} name={team.name} size={20} />
      {team.name}
    </span>
  );
}
