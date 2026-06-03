import Link from "next/link";
import { requireUserId } from "@/server/guards";
import {
  getUserPools,
  getMatchesWithBets,
  getUpcomingMatchesWithBets,
  getTournamentTeams,
} from "@/server/services/matches";
import { getBonusStatus } from "@/server/services/bonus";
import { MatchCard } from "@/components/match/match-card";
import { PendingBonus } from "@/components/bonus/pending-bonus";
import { PoolSelector } from "@/components/pool/pool-selector";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { STAGE_LABEL } from "@/lib/labels";
import type { MatchWithBet } from "@/server/services/matches";
import type { MatchStage } from "@prisma/client";

export const dynamic = "force-dynamic";

function dayRange(date = new Date()) {
  const from = new Date(date);
  from.setHours(0, 0, 0, 0);
  const to = new Date(date);
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

/** Agrupa os jogos por fase + data. */
function groupMatches(matches: MatchWithBet[]) {
  const groups = new Map<string, { stage: MatchStage; group: string | null; date: string; matches: MatchWithBet[] }>();
  for (const m of matches) {
    const date = new Date(m.kickoffAt).toLocaleDateString("pt-BR", {
      weekday: "long", day: "2-digit", month: "long",
    });
    const key = `${m.stage}|${m.group ?? ""}|${date}`;
    if (!groups.has(key)) groups.set(key, { stage: m.stage, group: m.group, date, matches: [] });
    groups.get(key)!.matches.push(m);
  }
  return [...groups.values()];
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ pool?: string }>;
}) {
  const userId = await requireUserId();
  const { pool: poolSlug } = await searchParams;
  const pools = await getUserPools(userId);

  if (pools.length === 0) {
    return (
      <Card>
        <CardContent className="space-y-4 py-10 text-center">
          <div className="text-5xl">🏆</div>
          <h2 className="text-lg font-semibold">Você ainda não está em nenhum bolão</h2>
          <p className="text-sm text-muted-foreground">
            Crie o seu bolão ou entre em um com o código de convite.
          </p>
          <div className="flex justify-center gap-2">
            <Link href="/pool/new" className={buttonVariants()}>Criar bolão</Link>
            <Link href="/pools" className={buttonVariants({ variant: "outline" })}>
              Entrar com código
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  const selected = pools.find((p) => p.slug === poolSlug) ?? pools[0];
  const { from, to } = dayRange();

  const [bonusStatus, teams] = await Promise.all([
    getBonusStatus({ userId, poolId: selected.id }),
    getTournamentTeams(),
  ]);

  const todayMatches = await getMatchesWithBets({ userId, poolId: selected.id, from, to });
  const matches =
    todayMatches.length > 0
      ? todayMatches
      : await getUpcomingMatchesWithBets({ userId, poolId: selected.id, take: 16 });

  const isToday = todayMatches.length > 0;
  const grouped = groupMatches(matches);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">
            {isToday ? "Jogos de hoje" : "Próximos jogos"}
          </h1>
          <Link
            href={`/b/${selected.slug}`}
            className="text-sm text-primary hover:underline"
          >
            Ver ranking · {selected.name} →
          </Link>
        </div>
        <PoolSelector pools={pools} current={selected.slug} />
      </div>

      <PendingBonus poolId={selected.id} status={bonusStatus} teams={teams} />

      {matches.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhum jogo disponível. Aguarde a importação do calendário da Copa 2026.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map((g, i) => (
            <section key={i}>
              {/* Separador de fase/data */}
              <div className="mb-3 flex items-center gap-3">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                    {STAGE_LABEL[g.stage]}
                    {g.group ? ` · Grupo ${g.group}` : ""}
                  </span>
                  <span className="text-sm capitalize text-muted-foreground">{g.date}</span>
                </div>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="space-y-3">
                {g.matches.map((m) => (
                  <MatchCard key={m.id} match={m} poolId={selected.id} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
