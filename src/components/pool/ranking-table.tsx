"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { Wifi } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog } from "@/components/ui/dialog";
import { Flag } from "@/components/flag";
import { getUserBetsInPool, type UserBetRow } from "@/server/actions/bets";
import type { RankingRow } from "@/server/services/ranking";

const MEDAL_COLOR: Record<number, string> = {
  1: "bg-yellow-400/15 text-yellow-400 border-yellow-400/30",
  2: "bg-gray-400/15 text-gray-300 border-gray-300/30",
  3: "bg-amber-700/15 text-amber-600 border-amber-600/30",
};

const MEDAL_EMOJI: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

interface SelectedUser {
  userId: string;
  name: string;
  image: string | null;
}

export function RankingTable({
  rows,
  currentUserId,
  poolId,
}: {
  rows: RankingRow[];
  currentUserId: string;
  poolId: string;
}) {
  const [selectedUser, setSelectedUser] = useState<SelectedUser | null>(null);
  const [bets, setBets] = useState<UserBetRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reduce = useReducedMotion();

  const handleRowClick = useCallback(
    async (user: SelectedUser) => {
      setSelectedUser(user);
      setBets(null);
      setError(null);
      setLoading(true);
      const result = await getUserBetsInPool(user.userId, poolId);
      setLoading(false);
      if (result.ok) {
        setBets(result.data);
      } else {
        setError(result.error);
      }
    },
    [poolId],
  );

  const handleClose = useCallback(() => {
    setSelectedUser(null);
    setBets(null);
    setError(null);
  }, []);

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem participantes ainda.</p>;
  }

  return (
    <>
      <LayoutGroup>
      <div className="space-y-2">
        {rows.map((r) => {
          const isMe = r.userId === currentUserId;
          const hasMedal = r.position <= 3;

          return (
            <motion.div
              key={r.userId}
              layout={reduce ? false : "position"}
              transition={{ type: "spring", stiffness: 500, damping: 42 }}
              role="button"
              tabIndex={0}
              onClick={() =>
                handleRowClick({
                  userId: r.userId,
                  name: r.name ?? "Anônimo",
                  image: r.image,
                })
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleRowClick({
                    userId: r.userId,
                    name: r.name ?? "Anônimo",
                    image: r.image,
                  });
                }
              }}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-secondary/40",
                r.isLive
                  ? "border-primary/50 bg-primary/5 ring-1 ring-primary/30"
                  : isMe
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
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span>
                    {r.hits} acerto{r.hits !== 1 ? "s" : ""} · {r.misses} erro
                    {r.misses !== 1 ? "s" : ""}
                  </span>
                  {r.isLive && (
                    <span className="flex items-center gap-0.5 font-semibold text-primary">
                      <Wifi className="h-3 w-3 animate-pulse" />
                      +{r.livePoints} ao vivo
                    </span>
                  )}
                </p>
              </div>

              {/* Pontuação */}
              <div className="text-right">
                <p
                  className={cn(
                    "text-lg font-bold tabular-nums",
                    r.isLive ? "text-primary" : hasMedal && "text-accent",
                  )}
                >
                  {r.totalPoints}
                </p>
                <p className="text-xs text-muted-foreground">pts</p>
              </div>
            </motion.div>
          );
        })}
      </div>
      </LayoutGroup>

      <Dialog
        open={!!selectedUser}
        onClose={handleClose}
        title={
          selectedUser ? (
            <div className="flex items-center gap-2">
              {selectedUser.image ? (
                <Image
                  src={selectedUser.image}
                  alt={selectedUser.name}
                  width={24}
                  height={24}
                  className="h-6 w-6 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                  {selectedUser.name.charAt(0).toUpperCase()}
                </div>
              )}
              <span>{selectedUser.name}</span>
            </div>
          ) : undefined
        }
        description="Jogos fechados com palpite"
      >
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}

        {error && (
          <p className="text-center text-sm text-destructive">{error}</p>
        )}

        {!loading && !error && bets?.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            Nenhum jogo finalizado com palpite ainda.
          </p>
        )}

        {!loading && !error && bets && bets.length > 0 && (() => {
          const totalPoints = bets.reduce((sum, b) => sum + (b.pointsEarned ?? 0), 0);
          const hits = bets.filter((b) => (b.pointsEarned ?? 0) > 0).length;
          const misses = bets.filter((b) => (b.pointsEarned ?? 0) === 0).length;
          return (
            <>
              <div className="space-y-2">
                {bets.map((b) => (
                  <div
                    key={b.matchId}
                    className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm"
                  >
                    {/* Time da casa */}
                    <div className="flex min-w-0 flex-1 items-center gap-1.5">
                      <Flag countryCode={b.homeCode} name={b.homeName} size={16} />
                      <span className="truncate">{b.homeName}</span>
                    </div>

                    {/* Placar */}
                    <div className="shrink-0 text-center">
                      <p className="font-mono font-bold tabular-nums">
                        {b.homeGuess} × {b.awayGuess}
                      </p>
                      {b.homeScore !== null && b.awayScore !== null && (
                        <p className="text-xs text-muted-foreground">
                          {b.homeScore} × {b.awayScore}
                        </p>
                      )}
                    </div>

                    {/* Time visitante */}
                    <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
                      <span className="truncate text-right">{b.awayName}</span>
                      <Flag countryCode={b.awayCode} name={b.awayName} size={16} />
                    </div>

                    {/* Pontos */}
                    <div className="ml-1 w-10 shrink-0 text-right">
                      <span
                        className={cn(
                          "text-xs font-semibold",
                          (b.pointsEarned ?? 0) > 0
                            ? "text-green-400"
                            : "text-muted-foreground",
                        )}
                      >
                        {b.pointsEarned ?? 0} pts
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Rodapé com totais */}
              <div className="flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                <span>
                  {hits} acerto{hits !== 1 ? "s" : ""} · {misses} erro
                  {misses !== 1 ? "s" : ""}
                </span>
                <span className="font-bold text-foreground">{totalPoints} pts</span>
              </div>
            </>
          );
        })()}
      </Dialog>
    </>
  );
}
