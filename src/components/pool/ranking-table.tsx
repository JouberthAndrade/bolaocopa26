import Image from "next/image";
import { cn } from "@/lib/utils";
import type { RankingRow } from "@/server/services/ranking";

const MEDAL_COLOR: Record<number, string> = {
  1: "bg-yellow-400/15 text-yellow-400 border-yellow-400/30",
  2: "bg-gray-400/15 text-gray-300 border-gray-300/30",
  3: "bg-amber-700/15 text-amber-600 border-amber-600/30",
};

const MEDAL_EMOJI: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export function RankingTable({
  rows,
  currentUserId,
}: {
  rows: RankingRow[];
  currentUserId: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem participantes ainda.</p>;
  }

  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const isMe = r.userId === currentUserId;
        const hasMedal = r.position <= 3;

        return (
          <div
            key={r.userId}
            className={cn(
              "flex items-center gap-3 rounded-xl border p-3 transition-colors",
              isMe
                ? "border-primary/40 bg-primary/10"
                : "border-border bg-card",
            )}
          >
            {/* Posição */}
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-bold",
                hasMedal
                  ? MEDAL_COLOR[r.position]
                  : "border-border bg-secondary text-muted-foreground",
              )}
            >
              {hasMedal ? MEDAL_EMOJI[r.position] : r.position}
            </div>

            {/* Avatar */}
            {r.image ? (
              <Image
                src={r.image}
                alt={r.name ?? ""}
                width={36}
                height={36}
                className="h-9 w-9 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-sm font-semibold">
                {(r.name ?? "?").charAt(0).toUpperCase()}
              </div>
            )}

            {/* Nome */}
            <div className="min-w-0 flex-1">
              <p className={cn("truncate font-semibold", isMe && "text-primary")}>
                {r.name ?? "Anônimo"}
                {isMe && <span className="ml-1 text-xs font-normal">(você)</span>}
              </p>
              <p className="text-xs text-muted-foreground">
                {r.hits} acerto{r.hits !== 1 ? "s" : ""} · {r.misses} erro{r.misses !== 1 ? "s" : ""}
              </p>
            </div>

            {/* Pontuação */}
            <div className="text-right">
              <p className={cn("text-lg font-bold tabular-nums", hasMedal && "text-accent")}>
                {r.totalPoints}
              </p>
              <p className="text-xs text-muted-foreground">pts</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
