import Link from "next/link";
import { requireUserId } from "@/server/guards";
import {
  getUserPools,
  getAllMatchesWithBets,
  isGroupStageComplete,
} from "@/server/services/matches";
import { PhaseView } from "@/components/knockout/phase-view";
import { PoolSelector } from "@/components/pool/pool-selector";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function KnockoutPage({
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
          <h2 className="text-lg font-semibold">Entre em um bolão para palpitar</h2>
          <p className="text-sm text-muted-foreground">
            As fases finais ficam disponíveis assim que você participar de um bolão.
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
  const [matches, groupComplete] = await Promise.all([
    getAllMatchesWithBets({ userId, poolId: selected.id }),
    isGroupStageComplete(),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Mata-mata</h1>
          <p className="text-sm text-muted-foreground">
            Navegue pelas fases · {selected.name}
          </p>
        </div>
        <PoolSelector pools={pools} current={selected.slug} basePath="/knockout" />
      </div>

      <PhaseView matches={matches} poolId={selected.id} groupComplete={groupComplete} />
    </div>
  );
}
