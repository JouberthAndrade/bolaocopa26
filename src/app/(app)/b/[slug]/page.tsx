import Link from "next/link";
import { PencilLine } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { requireUserId } from "@/server/guards";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getPoolBySlug } from "@/server/services/pool";
import { getRanking } from "@/server/services/ranking";
import { getRaceData } from "@/server/services/race";
import { getRevealedMatchups } from "@/server/services/matchups";
import { getBonusMatchup } from "@/server/services/bonus";
import { BonusMatchup } from "@/components/bonus/bonus-matchup";
import { RankingTable } from "@/components/pool/ranking-table";
import { RaceTrack } from "@/components/pool/race-track";
import { ConfrontoList } from "@/components/pool/confronto-list";
import { TopScorers } from "@/components/pool/top-scorers";
import { InviteCard } from "@/components/pool/invite-card";
import { PoolTabs, type PoolTab } from "@/components/pool/pool-tabs";
import { AutoRefresh } from "@/components/auto-refresh";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Tab = PoolTab;

export default async function PoolPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: Tab }>;
}) {
  const userId = await requireUserId();
  const { slug } = await params;
  const { tab = "ranking" } = await searchParams;

  const pool = await getPoolBySlug(slug);
  if (!pool) notFound();

  const membership = await db.membership.findUnique({
    where: { userId_poolId: { userId, poolId: pool.id } },
  });
  // Não-membro: manda para o fluxo de convite.
  if (!membership) redirect(`/invite/${pool.invites[0]?.code ?? ""}`);

  const isAdmin = membership.role === "OWNER" || membership.role === "ADMIN";

  return (
    <div className="space-y-4">
      <AutoRefresh />

      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="text-xl font-bold">{pool.name}</h1>
          {pool.description && (
            <p className="text-sm text-muted-foreground">{pool.description}</p>
          )}
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span>{pool._count.memberships} participantes</span>
            {Number(pool.stakeAmount) > 0 && (
              <span>Aposta: {formatCurrency(Number(pool.stakeAmount), pool.currency)}</span>
            )}
          </div>
        </div>
        <Link
          href={`/?pool=${pool.slug}`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <PencilLine className="h-4 w-4" aria-hidden />
          Palpitar
        </Link>
      </header>

      <PoolTabs slug={slug} active={tab} />

      {tab === "ranking" && <RankingSection poolId={pool.id} userId={userId} />}
      {tab === "corrida" && <CorridaSection poolId={pool.id} userId={userId} />}
      {tab === "confronto" && <ConfrontoSection poolId={pool.id} />}
      {tab === "artilharia" && <TopScorers />}
      {tab === "regras" && (
        <RulesSection
          pool={pool}
          inviteCode={pool.invites[0]?.code ?? ""}
          showInvite
        />
      )}

      {isAdmin && tab === "ranking" && pool.invites[0] && (
        <InviteCard code={pool.invites[0].code} appUrl={env.NEXT_PUBLIC_APP_URL} />
      )}
    </div>
  );
}

async function RankingSection({ poolId, userId }: { poolId: string; userId: string }) {
  const rows = await getRanking(poolId);
  return <RankingTable rows={rows} currentUserId={userId} poolId={poolId} />;
}

async function CorridaSection({ poolId, userId }: { poolId: string; userId: string }) {
  const race = await getRaceData(poolId);
  // Largura contida e centralizada: a pista foi desenhada para ~600px; em coluna
  // única de largura total no desktop ela ficaria esparsa. Centralizar dá um palco
  // focado pra corrida sem quebrar o mobile (onde max-w não limita).
  return (
    <div className="mx-auto w-full max-w-2xl">
      <RaceTrack data={race} currentUserId={userId} />
    </div>
  );
}

async function ConfrontoSection({ poolId }: { poolId: string }) {
  const [matches, bonusRows] = await Promise.all([
    getRevealedMatchups(poolId),
    getBonusMatchup(poolId),
  ]);
  return (
    <div className="space-y-4">
      {bonusRows && <BonusMatchup rows={bonusRows} />}
      <ConfrontoList poolId={poolId} matches={matches} />
    </div>
  );
}

function RulesSection({
  pool,
  inviteCode,
  showInvite,
}: {
  pool: NonNullable<Awaited<ReturnType<typeof getPoolBySlug>>>;
  inviteCode: string;
  showInvite: boolean;
}) {
  const r = pool.scoringRule;
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-2 font-semibold">Pontuação</h3>
        <ul className="space-y-1 text-sm text-muted-foreground">
          {r && r.pointsCorrectResult === r.pointsCorrectDraw ? (
            <>
              <li>Placar exato: <b className="text-foreground">{r.pointsCorrectResult + r.pointsExactScore}</b> pts</li>
              <li>Acertar o resultado (vencedor ou empate): <b className="text-foreground">{r.pointsCorrectResult}</b> pts</li>
            </>
          ) : (
            <>
              <li>Acertar o vencedor: <b className="text-foreground">{r?.pointsCorrectResult}</b> pts</li>
              <li>Acertar empate: <b className="text-foreground">{r?.pointsCorrectDraw}</b> pts</li>
              <li>Placar exato: <b className="text-foreground">+{r?.pointsExactScore}</b> pts (bônus)</li>
            </>
          )}
          <li>Bônus campeão: <b className="text-foreground">{r?.championBonus}</b> pts</li>
          <li>Bônus vice: <b className="text-foreground">{r?.runnerUpBonus}</b> pts</li>
          <li>Bônus artilheiro: <b className="text-foreground">{r?.topScorerBonus}</b> pts</li>
        </ul>
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-2 font-semibold">Premiação</h3>
        <ul className="space-y-1 text-sm text-muted-foreground">
          {pool.prizeTiers.map((t) => (
            <li key={t.id}>
              {t.position}º lugar: <b className="text-foreground">{Number(t.percentage)}%</b>
            </li>
          ))}
        </ul>
      </div>
      {showInvite && inviteCode && (
        <InviteCard code={inviteCode} appUrl={env.NEXT_PUBLIC_APP_URL} />
      )}
    </div>
  );
}
