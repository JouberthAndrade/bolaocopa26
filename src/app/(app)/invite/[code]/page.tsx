import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUserId } from "@/server/guards";
import { AcceptInvite } from "@/components/pool/accept-invite";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const userId = await requireUserId();
  const { code } = await params;

  const invite = await db.invite.findUnique({
    where: { code: code.toUpperCase() },
    include: { pool: { include: { _count: { select: { memberships: true } } } } },
  });
  if (!invite) notFound();

  const alreadyMember = await db.membership.findUnique({
    where: { userId_poolId: { userId, poolId: invite.poolId } },
    select: { id: true },
  });

  return (
    <div className="mx-auto max-w-sm py-8">
      <Card>
        <CardContent className="space-y-4 py-8 text-center">
          <div className="text-4xl">🏆</div>
          <div>
            <p className="text-sm text-muted-foreground">Você foi convidado para</p>
            <h1 className="text-xl font-bold">{invite.pool.name}</h1>
            <p className="text-xs text-muted-foreground">
              {invite.pool._count.memberships} participantes
            </p>
          </div>
          {invite.pool.description && (
            <p className="text-sm text-muted-foreground">{invite.pool.description}</p>
          )}
          <AcceptInvite code={invite.code} />
          {alreadyMember && (
            <p className="text-xs text-muted-foreground">Você já participa deste bolão.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
