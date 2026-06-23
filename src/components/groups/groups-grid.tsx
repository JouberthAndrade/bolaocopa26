"use client";

import { useState } from "react";
import { Pencil, Lock } from "lucide-react";
import { Flag } from "@/components/flag";
import { MatchCard } from "@/components/match/match-card";
import { Dialog } from "@/components/ui/dialog";
import { isBettable, cn } from "@/lib/utils";
import type { MatchWithBet } from "@/server/services/matches";
import type { TeamStanding } from "@/lib/group";

interface GroupData {
  letter: string;
  teams: { id: string; name: string; countryCode: string }[];
  standings: TeamStanding[];
  matches: MatchWithBet[];
}

export function GroupsGrid({
  groups,
  poolId,
}: {
  groups: GroupData[];
  poolId: string;
}) {
  const [openLetter, setOpenLetter] = useState<string | null>(null);
  const active = groups.find((g) => g.letter === openLetter) ?? null;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((group) => {
          const openBets = group.matches.filter(
            (m) => isBettable(m.lockAt) && m.status === "SCHEDULED",
          ).length;
          const placed = group.matches.filter((m) => m.bet).length;

          return (
            <button
              key={group.letter}
              type="button"
              onClick={() => setOpenLetter(group.letter)}
              className="overflow-hidden rounded-2xl border border-border bg-card text-left transition-colors hover:border-primary"
            >
              <div className="flex items-center justify-between bg-primary/15 px-4 py-2">
                <h2 className="font-bold text-primary">Grupo {group.letter}</h2>
                <span className="flex items-center gap-1 text-xs font-medium text-primary">
                  <Pencil className="h-3 w-3" />
                  Palpitar
                </span>
              </div>

              {/* Tabela de classificação */}
              <div className="px-2 py-1">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="w-5 py-1 text-center font-medium">#</th>
                      <th className="py-1 text-left font-medium pl-1">Seleção</th>
                      <th className="w-7 py-1 text-center font-bold text-foreground">P</th>
                      <th className="w-6 py-1 text-center font-medium">J</th>
                      <th className="w-6 py-1 text-center font-medium">V</th>
                      <th className="w-6 py-1 text-center font-medium">E</th>
                      <th className="w-6 py-1 text-center font-medium">D</th>
                      <th className="w-8 py-1 text-center font-medium">SG</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {group.standings.map((s) => (
                      <tr key={s.teamId} className={cn(
                        "transition-colors",
                        s.position <= 2 && "bg-primary/5",
                      )}>
                        <td className="py-1.5 text-center text-muted-foreground">{s.position}</td>
                        <td className="py-1.5 pl-1">
                          <div className="flex items-center gap-1.5">
                            <Flag countryCode={s.countryCode} name={s.name} size={18} />
                            <span className="truncate max-w-[80px] font-medium">{s.name}</span>
                          </div>
                        </td>
                        <td className="py-1.5 text-center font-bold">{s.points}</td>
                        <td className="py-1.5 text-center text-muted-foreground">{s.played}</td>
                        <td className="py-1.5 text-center text-muted-foreground">{s.won}</td>
                        <td className="py-1.5 text-center text-muted-foreground">{s.drawn}</td>
                        <td className="py-1.5 text-center text-muted-foreground">{s.lost}</td>
                        <td className={cn(
                          "py-1.5 text-center",
                          s.goalDiff > 0 ? "text-primary" : s.goalDiff < 0 ? "text-destructive" : "text-muted-foreground",
                        )}>
                          {s.goalDiff > 0 ? `+${s.goalDiff}` : s.goalDiff}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground">
                <span>{group.matches.length} jogos</span>
                <span>
                  {placed} palpitados
                  {openBets === 0 && group.matches.length > 0 && (
                    <Lock className="ml-1 inline h-3 w-3" />
                  )}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <Dialog
        open={openLetter !== null}
        onClose={() => setOpenLetter(null)}
        title={active ? `Grupo ${active.letter}` : "Grupo"}
        description="Lance ou edite seus palpites desta chave · fecha 20 min antes de cada jogo"
      >
        {active && active.matches.length > 0 ? (
          active.matches.map((m) => (
            <MatchCard key={m.id} match={m} poolId={poolId} />
          ))
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Os jogos deste grupo ainda não foram definidos.
          </p>
        )}
      </Dialog>
    </>
  );
}
