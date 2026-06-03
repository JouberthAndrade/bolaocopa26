"use client";

import { useState } from "react";
import { Pencil, Lock } from "lucide-react";
import { Flag } from "@/components/flag";
import { MatchCard } from "@/components/match/match-card";
import { Dialog } from "@/components/ui/dialog";
import { isBettable } from "@/lib/utils";
import type { MatchWithBet } from "@/server/services/matches";

interface GroupData {
  letter: string;
  teams: { id: string; name: string; countryCode: string }[];
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

              <ul className="divide-y divide-border">
                {group.teams.map((team) => (
                  <li key={team.id} className="flex items-center gap-3 px-4 py-3">
                    <Flag countryCode={team.countryCode} name={team.name} size={32} />
                    <span className="font-medium">{team.name}</span>
                  </li>
                ))}
              </ul>

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
        description="Lance ou edite seus palpites desta chave"
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
