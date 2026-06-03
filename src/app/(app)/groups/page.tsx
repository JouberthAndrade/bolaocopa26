import { requireUserId } from "@/server/guards";
import { getGroups, getGroupsWithMatches } from "@/server/services/groups";
import { getUserPools } from "@/server/services/matches";
import { GroupsGrid } from "@/components/groups/groups-grid";
import { PoolSelector } from "@/components/pool/pool-selector";
import { Flag } from "@/components/flag";

export const dynamic = "force-dynamic";

export default async function GroupsPage({
  searchParams,
}: {
  searchParams: Promise<{ pool?: string }>;
}) {
  const userId = await requireUserId();
  const { pool: poolSlug } = await searchParams;
  const pools = await getUserPools(userId);

  // Sem bolão: exibe os grupos somente leitura (não dá pra palpitar).
  if (pools.length === 0) {
    const groups = await getGroups();
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold">Grupos da Copa 2026</h1>
        {groups.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map(({ letter, teams }) => (
              <div key={letter} className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="bg-primary/15 px-4 py-2">
                  <h2 className="font-bold text-primary">Grupo {letter}</h2>
                </div>
                <ul className="divide-y divide-border">
                  {teams.map((team) => (
                    <li key={team.id} className="flex items-center gap-3 px-4 py-3">
                      <Flag countryCode={team.countryCode} name={team.name} size={32} />
                      <span className="font-medium">{team.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const selected = pools.find((p) => p.slug === poolSlug) ?? pools[0];
  const groups = await getGroupsWithMatches({ userId, poolId: selected.id });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Grupos da Copa 2026</h1>
          <p className="text-sm text-muted-foreground">
            Toque em um grupo para palpitar · {selected.name}
          </p>
        </div>
        <PoolSelector pools={pools} current={selected.slug} basePath="/groups" />
      </div>

      {groups.length === 0 ? (
        <EmptyState />
      ) : (
        <GroupsGrid groups={groups} poolId={selected.id} />
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="py-10 text-center text-sm text-muted-foreground">
      Grupos ainda não importados. Execute <code>npm run sync:matches</code>.
    </div>
  );
}
