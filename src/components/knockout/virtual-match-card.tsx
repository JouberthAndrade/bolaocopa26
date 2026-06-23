import { Lock, Shield } from "lucide-react";
import { Flag } from "@/components/flag";
import { cn } from "@/lib/utils";
import { STAGE_LABEL } from "@/lib/labels";
import type { MatchWithBet } from "@/server/services/matches";

export function VirtualMatchCard({ match }: { match: MatchWithBet }) {
  const kickoff = new Date(match.kickoffAt);
  const dateStr = kickoff.toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit",
  });
  const weekday = kickoff.toLocaleDateString("pt-BR", { weekday: "short" });

  function TeamSlot({
    name, countryCode, label,
  }: { name: string; countryCode: string; label?: string }) {
    const resolved = countryCode.length > 0;
    return (
      <div className="flex flex-col items-center gap-2">
        {resolved ? (
          <Flag countryCode={countryCode} name={name} size={52} />
        ) : (
          <div className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-secondary">
            <Shield className="h-7 w-7 text-muted-foreground/50" />
          </div>
        )}
        <span className={cn(
          "text-center text-sm font-semibold leading-tight",
          !resolved && "text-muted-foreground",
        )}>
          {resolved ? name : (label ?? name)}
        </span>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/80">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between bg-secondary/30 px-4 py-2 text-xs font-medium text-muted-foreground">
        <span>
          {STAGE_LABEL[match.stage]}
          {match.slotLabel ? ` · ${match.slotLabel}` : ""}
        </span>
        <span className="flex items-center gap-1.5">
          <Lock className="h-3 w-3" />
          {dateStr} · {weekday}
        </span>
      </div>

      {/* Times */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-4 opacity-70">
        <TeamSlot
          name={match.home.name}
          countryCode={match.home.countryCode}
          label={match.homeLabel}
        />
        <span className="text-xl font-light text-muted-foreground">×</span>
        <TeamSlot
          name={match.away.name}
          countryCode={match.away.countryCode}
          label={match.awayLabel}
        />
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
