import Link from "next/link";
import Image from "next/image";
import { Trophy, ChevronRight } from "lucide-react";
import type { PositionSummary } from "@/lib/position-summary";
import { cn } from "@/lib/utils";

/** Card "Sua posição": destaque do usuário + mini top-3 do bolão. */
export function PositionCard({
  summary,
  currentUserId,
  poolSlug,
}: {
  summary: PositionSummary;
  currentUserId: string;
  poolSlug: string;
}) {
  const { me, top3 } = summary;

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Sua posição</p>
          <p className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums">
              {me ? `${me.position}º` : "—"}
            </span>
            {me && (
              <span className="text-sm text-muted-foreground">
                de {summary.total}
              </span>
            )}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium text-muted-foreground">Seus pontos</p>
          <p className="flex items-center justify-end gap-1 text-3xl font-bold tabular-nums text-primary">
            <Trophy className="h-5 w-5" />
            {me?.totalPoints ?? 0}
          </p>
        </div>
      </div>

      {top3.length > 0 && (
        <ul className="mt-4 space-y-1.5 border-t border-border pt-3">
          {top3.map((r) => (
            <li
              key={r.userId}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2 py-1 text-sm",
                r.userId === currentUserId && "bg-secondary/60",
              )}
            >
              <span className="w-5 text-center font-bold tabular-nums text-muted-foreground">
                {r.position}
              </span>
              {r.image ? (
                <Image
                  src={r.image}
                  alt={r.name ?? "participante"}
                  width={24}
                  height={24}
                  className="rounded-full"
                />
              ) : (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                  {(r.name ?? "?").charAt(0).toUpperCase()}
                </span>
              )}
              <span className="flex-1 truncate font-medium">{r.name ?? "—"}</span>
              <span className="font-bold tabular-nums">{r.totalPoints}</span>
            </li>
          ))}
        </ul>
      )}

      <Link
        href={`/b/${poolSlug}`}
        className="mt-3 flex items-center justify-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        Ver ranking completo
        <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
