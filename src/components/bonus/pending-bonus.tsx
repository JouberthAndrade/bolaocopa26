"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertCircle, Check, Lock, Pencil } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { BonusBetsForm } from "@/components/bonus/bonus-bets-form";
import { cn } from "@/lib/utils";
import type { BonusStatus } from "@/server/services/bonus";

interface Team {
  id: string;
  name: string;
  countryCode: string;
}

/**
 * Banner de pendências de palpites-bônus (campeão / vice / artilheiro)
 * exibido na tela inicial conforme as regras do bolão.
 */
export function PendingBonus({
  poolId,
  status,
  teams,
}: {
  poolId: string;
  status: BonusStatus;
  teams: Team[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (status.items.length === 0) return null;

  const teamName = (id: string | null) =>
    id ? teams.find((t) => t.id === id)?.name ?? "—" : null;

  const valueOf = (key: string) => {
    if (key === "champion") return teamName(status.current.champTeamId);
    if (key === "runnerUp") return teamName(status.current.runnerUpTeamId);
    return status.current.topScorerName;
  };

  const pending = status.pendingCount;
  const allDone = pending === 0;

  return (
    <>
      <section
        className={cn(
          "rounded-2xl border p-4",
          status.open && !allDone
            ? "border-accent/50 bg-accent/10"
            : "border-border bg-card",
        )}
      >
        <header className="mb-3 flex items-center gap-2">
          {!status.open ? (
            <Lock className="h-4 w-4 text-muted-foreground" />
          ) : allDone ? (
            <Check className="h-4 w-4 text-primary" />
          ) : (
            <AlertCircle className="h-4 w-4 text-accent" />
          )}
          <h2 className="text-sm font-semibold">
            {!status.open
              ? "Palpites de bônus encerrados"
              : allDone
                ? "Palpites de bônus completos"
                : `Você tem ${pending} ${pending === 1 ? "palpite" : "palpites"} de bônus pendente${pending === 1 ? "" : "s"}`}
          </h2>
        </header>

        <ul className="space-y-1.5">
          {status.items.map((item) => {
            const value = valueOf(item.key);
            return (
              <li
                key={item.key}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <div className="flex min-w-0 items-center gap-2">
                  {item.filled ? (
                    <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                  ) : (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  )}
                  <span className="font-medium">{item.label}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {value ?? item.hint}
                  </span>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  +{item.bonus} pts
                </span>
              </li>
            );
          })}
        </ul>

        {status.open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Pencil className="h-3.5 w-3.5" />
            {allDone ? "Editar palpites" : "Palpitar agora"}
          </button>
        )}
      </section>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Palpites de bônus"
        description="Campeão, vice e artilheiro — valem pontos extras"
      >
        <BonusBetsForm
          poolId={poolId}
          teams={teams}
          items={status.items}
          current={status.current}
          onSaved={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      </Dialog>
    </>
  );
}
