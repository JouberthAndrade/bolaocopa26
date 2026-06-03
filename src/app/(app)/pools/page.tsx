import Link from "next/link";
import { Users } from "lucide-react";
import { requireUserId } from "@/server/guards";
import { getUserPools } from "@/server/services/matches";
import { JoinPoolForm } from "@/components/pool/join-pool-form";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function PoolsPage() {
  const userId = await requireUserId();
  const pools = await getUserPools(userId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Meus bolões</h1>
        <Link href="/pool/new" className={buttonVariants({ size: "sm" })}>
          Criar bolão
        </Link>
      </div>

      <Card>
        <CardContent className="space-y-2 pt-6">
          <p className="text-sm font-medium">Entrar em um bolão</p>
          <JoinPoolForm />
        </CardContent>
      </Card>

      <div className="space-y-2">
        {pools.length === 0 ? (
          <p className="text-sm text-muted-foreground">Você ainda não participa de nenhum bolão.</p>
        ) : (
          pools.map((p) => (
            <Link
              key={p.id}
              href={`/b/${p.slug}`}
              className="flex items-center justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary"
            >
              <div>
                <p className="font-semibold">{p.name}</p>
                <p className="text-xs text-muted-foreground">/b/{p.slug}</p>
              </div>
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                {p._count.memberships}
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
