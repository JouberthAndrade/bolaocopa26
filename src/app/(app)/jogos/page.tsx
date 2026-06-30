import Link from "next/link";
import { ListChecks, Receipt, ChevronRight } from "lucide-react";
import { requireUserId } from "@/server/guards";
import {
  getUserPools,
  getAllMatchesWithBets,
  getTournamentTeams,
} from "@/server/services/matches";
import { getBonusStatus } from "@/server/services/bonus";
import { MatchesExplorer } from "@/components/match/matches-explorer";
import { PendingBonus } from "@/components/bonus/pending-bonus";
import { AutoRefresh } from "@/components/auto-refresh";
import { PoolSelector } from "@/components/pool/pool-selector";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function JogosPage({
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

  const [bonusStatus, teams, matches] = await Promise.all([
    getBonusStatus({ userId, poolId: selected.id }),
    getTournamentTeams(),
    getAllMatchesWithBets({ userId, poolId: selected.id }),
  ]);

  // Resumo de palpites dos jogos: já palpitados / total disponível.
  const totalMatches = matches.length;
  const betCount = matches.filter((m) => m.bet).length;

  return (
    <div className="space-y-6">
      {/* Atualiza placares ao vivo sem reload manual */}
      <AutoRefresh />

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Jogos da Copa</h1>
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

      {/* Progresso de palpites dos jogos — leva ao extrato */}
      <Link
        href={`/extrato?pool=${selected.slug}`}
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
            <Receipt className="h-4 w-4" />
            Ver extrato
            <ChevronRight className="h-4 w-4" />
          </span>
        </span>
      </Link>

      {totalMatches === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhum jogo disponível. Aguarde a importação do calendário da Copa 2026.
          </CardContent>
        </Card>
      ) : (
        <MatchesExplorer matches={matches} poolId={selected.id} />
      )}
    </div>
  );
}
