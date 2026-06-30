import Link from "next/link";
import { ListChecks, ChevronRight } from "lucide-react";
import { requireUserId } from "@/server/guards";
import {
  getUserPools,
  getAllMatchesWithBets,
  getTournamentTeams,
  getTodayMatchesWithBets,
} from "@/server/services/matches";
import { getRanking } from "@/server/services/ranking";
import { getBonusStatus } from "@/server/services/bonus";
import { derivePositionSummary } from "@/lib/position-summary";
import { PendingBonus } from "@/components/bonus/pending-bonus";
import { AutoRefresh } from "@/components/auto-refresh";
import { PoolSelector } from "@/components/pool/pool-selector";
import { QuickLinks } from "@/components/home/quick-links";
import { PositionCard } from "@/components/home/position-card";
import { TodayMatches } from "@/components/home/today-matches";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

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

  const [bonusStatus, teams, rankingRows, todayMatches, allMatches] = await Promise.all([
    getBonusStatus({ userId, poolId: selected.id }),
    getTournamentTeams(),
    getRanking(selected.id),
    getTodayMatchesWithBets({ userId, poolId: selected.id }),
    getAllMatchesWithBets({ userId, poolId: selected.id }),
  ]);

  const summary = derivePositionSummary(rankingRows, userId);
  const totalMatches = allMatches.length;
  const betCount = allMatches.filter((m) => m.bet).length;

  return (
    <div className="space-y-6">
      {/* Atualiza placares/ranking ao vivo sem reload manual */}
      <AutoRefresh />

      {/* Cabeçalho do bolão */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{selected.name}</h1>
          <p className="text-sm text-muted-foreground">Seu painel do bolão</p>
        </div>
        <PoolSelector pools={pools} current={selected.slug} />
      </div>

      <PendingBonus poolId={selected.id} status={bonusStatus} teams={teams} />

      <PositionCard summary={summary} currentUserId={userId} poolSlug={selected.slug} />

      <QuickLinks />

      {/* Progresso de palpites dos jogos — leva à tela de Jogos */}
      <Link
        href={`/jogos?pool=${selected.slug}`}
        className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 transition-colors hover:border-primary/60"
      >
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Palpites dos jogos</span>
        </div>
        <span className="flex items-center gap-2 text-sm">
          <span className="font-bold tabular-nums">
            {betCount}
            <span className="text-muted-foreground">/{totalMatches}</span>
          </span>
          <span className="flex items-center gap-1 text-primary">
            Palpitar
            <ChevronRight className="h-4 w-4" />
          </span>
        </span>
      </Link>

      <TodayMatches matches={todayMatches} poolSlug={selected.slug} />
    </div>
  );
}
