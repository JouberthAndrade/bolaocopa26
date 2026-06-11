import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUserId } from "@/server/guards";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getPoolBySlug } from "@/server/services/pool";
import { getRanking } from "@/server/services/ranking";
import { getFeed } from "@/server/services/feed";
import { getFinishedMatchups } from "@/server/services/matchups";
import { RankingTable } from "@/components/pool/ranking-table";
import { FeedList } from "@/components/pool/feed-list";
import { ConfrontoList } from "@/components/pool/confronto-list";
import { InviteCard } from "@/components/pool/invite-card";
import { AutoRefresh } from "@/components/auto-refresh";
import { formatCurrency, cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Tab = "ranking" | "feed" | "confronto" | "regras";

const TABS: { key: Tab; label: string }[] = [
  { key: "ranking", label: "Ranking" },
  { key: "feed", label: "Feed" },
  { key: "confronto", label: "Confronto" },
  { key: "regras", label: "Regras" },
];

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

      <header className="space-y-1">
        <h1 className="text-xl font-bold">{pool.name}</h1>
        {pool.description && (
          <p className="text-sm text-muted-foreground">{pool.description}</p>
        )}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span>{pool._count.memberships} participantes</span>
          {Number(pool.stakeAmount) > 0 && (
            <span>Aposta: {formatCurrency(Number(pool.stakeAmount), pool.currency)}</span>
          )}
          <Link href={`/?pool=${pool.slug}`} className="text-primary hover:underline">
            Palpitar →
          </Link>
        </div>
      </header>

      <nav className="flex gap-1 rounded-lg border border-border bg-card p-1">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/b/${slug}?tab=${t.key}`}
            className={cn(
              "flex-1 rounded-md py-2 text-center text-sm font-medium transition-colors",
              tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "ranking" && <RankingSection poolId={pool.id} userId={userId} />}
      {tab === "feed" && <FeedSection poolId={pool.id} />}
      {tab === "confronto" && <ConfrontoSection poolId={pool.id} />}
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
  return <RankingTable rows={rows} currentUserId={userId} />;
}

async function FeedSection({ poolId }: { poolId: string }) {
  const items = await getFeed(poolId);
  return <FeedList items={items} />;
}

async function ConfrontoSection({ poolId }: { poolId: string }) {
  const matches = await getFinishedMatchups(poolId);
  return <ConfrontoList poolId={poolId} matches={matches} />;
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
