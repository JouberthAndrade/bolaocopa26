"use client";

import { useState } from "react";
import Image from "next/image";
import { Bot, Medal, Trophy, Users, ChevronRight } from "lucide-react";
import { Flag } from "@/components/flag";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { BonusMatchupRow } from "@/server/services/bonus";

type CatKey = "champ" | "runnerUp" | "topScorer";

interface Category {
  key: CatKey;
  label: string;
  icon: string;
  hint: string;
}

/** Categorias de bônus, na mesma ordem do palpite (campeão · vice · artilheiro). */
const CATEGORIES: Category[] = [
  { key: "champ", label: "Campeão", icon: "🏆", hint: "Quem levanta a taça" },
  { key: "runnerUp", label: "Vice-campeão", icon: "🥈", hint: "O outro finalista" },
  { key: "topScorer", label: "Artilheiro", icon: "🎯", hint: "Maior goleador do torneio" },
];

/** true quando o participante palpitou nesta categoria. */
function hasPick(row: BonusMatchupRow, key: CatKey): boolean {
  return key === "topScorer" ? !!row.topScorer : !!row[key];
}

/**
 * Palpites de bônus (campeão / vice / artilheiro) de todos os participantes,
 * agrupados por categoria — equivalente aos palpites dos jogos: cada categoria
 * é uma linha clicável que abre os palpites de todo mundo num diálogo.
 *
 * Os dados só chegam aqui depois do prazo (getBonusMatchup retorna null antes),
 * então nunca renderiza palpite ainda editável.
 */
export function BonusMatchup({ rows }: { rows: BonusMatchupRow[] }) {
  const [open, setOpen] = useState<Category | null>(null);

  if (rows.length === 0) return null;

  return (
    <section className="rounded-2xl border border-border bg-card">
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Trophy className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Palpites de bônus</h2>
        <span className="text-xs text-muted-foreground">campeão · vice · artilheiro</span>
      </header>

      <ul className="divide-y divide-border">
        {CATEGORIES.map((cat) => {
          const count = rows.filter((r) => hasPick(r, cat.key)).length;
          return (
            <li key={cat.key}>
              <button
                type="button"
                onClick={() => setOpen(cat)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/40"
              >
                <span className="text-lg" aria-hidden>
                  {cat.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{cat.label}</p>
                  <p className="text-xs text-muted-foreground">{cat.hint}</p>
                </div>
                <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  {count}
                  <ChevronRight className="h-4 w-4" />
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <Dialog
        open={open !== null}
        onClose={() => setOpen(null)}
        title={open ? `${open.icon} ${open.label}` : ""}
        description="Palpites dos participantes"
      >
        {open && <BonusPickList rows={rows} cat={open} />}
      </Dialog>
    </section>
  );
}

/** Lista de participantes e seus palpites para uma categoria (bots primeiro). */
function BonusPickList({ rows, cat }: { rows: BonusMatchupRow[]; cat: Category }) {
  const bots = rows.filter((r) => r.isBot);
  const humans = rows.filter((r) => !r.isBot);

  return (
    <div className="space-y-4">
      {bots.length > 0 && (
        <section className="space-y-2">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Bot className="h-3.5 w-3.5" />
            Inteligência Artificial
          </h4>
          <ul className="space-y-2">
            {bots.map((r) => (
              <BonusPickRow key={r.userId} row={r} cat={cat} />
            ))}
          </ul>
        </section>
      )}

      {humans.length > 0 && (
        <section className="space-y-2">
          {bots.length > 0 && (
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Participantes
            </h4>
          )}
          <ul className="space-y-2">
            {humans.map((r) => (
              <BonusPickRow key={r.userId} row={r} cat={cat} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function BonusPickRow({ row, cat }: { row: BonusMatchupRow; cat: Category }) {
  const picked = hasPick(row, cat.key);
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-lg border border-border bg-card p-2.5",
        picked ? "" : "opacity-60",
      )}
    >
      <Avatar row={row} />
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {row.name ?? "Anônimo"}
      </span>
      {picked ? (
        <BonusPick row={row} cat={cat} />
      ) : (
        <span className="text-xs text-muted-foreground">Não palpitou</span>
      )}
    </li>
  );
}

function BonusPick({ row, cat }: { row: BonusMatchupRow; cat: Category }) {
  if (cat.key === "topScorer") {
    return (
      <span className="flex items-center gap-1.5 text-sm font-semibold">
        <Medal className="h-3.5 w-3.5 text-amber-500" />
        {row.topScorer}
      </span>
    );
  }
  const team = row[cat.key];
  if (!team) return null;
  return (
    <span className="flex items-center gap-1.5 text-sm font-semibold">
      <Flag countryCode={team.countryCode} name={team.name} size={20} />
      {team.name}
    </span>
  );
}

function Avatar({ row }: { row: BonusMatchupRow }) {
  if (row.isBot) {
    return (
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          row.botKind === "GEPETO"
            ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300"
            : "bg-violet-500/20 text-violet-500 dark:text-violet-300",
        )}
      >
        <Bot className="h-4 w-4" />
      </div>
    );
  }
  if (row.image) {
    return (
      <Image
        src={row.image}
        alt={row.name ?? ""}
        width={32}
        height={32}
        className="h-8 w-8 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
      {(row.name ?? "?").charAt(0).toUpperCase()}
    </div>
  );
}
