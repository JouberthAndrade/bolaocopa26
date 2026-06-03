"use server";

import { revalidatePath } from "next/cache";
import { customAlphabet } from "nanoid";
import { db } from "@/lib/db";
import { requireUserId } from "@/server/guards";
import { ensureTournament } from "@/server/services/sync";
import { createPoolSchema, joinPoolSchema } from "@/lib/validations";

const inviteCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 8);

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function createPool(
  input: unknown,
): Promise<ActionResult<{ slug: string }>> {
  const userId = await requireUserId();
  const parsed = createPoolSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  const d = parsed.data;

  const slugTaken = await db.pool.findUnique({ where: { slug: d.slug } });
  if (slugTaken) return { ok: false, error: "Esse identificador (slug) já está em uso" };

  const tournamentId = await ensureTournament();

  const pool = await db.pool.create({
    data: {
      name: d.name,
      slug: d.slug,
      description: d.description || null,
      stakeAmount: d.stakeAmount,
      currency: d.currency,
      entryDeadline: d.entryDeadline ?? null,
      betsVisibility: d.betsVisibility,
      tournamentId,
      ownerId: userId,
      scoringRule: {
        create: {
          pointsExactScore: d.pointsExactScore,
          pointsCorrectResult: d.pointsCorrectResult,
          pointsCorrectDraw: d.pointsCorrectDraw,
          championBonus: d.championBonus,
          runnerUpBonus: d.runnerUpBonus,
          topScorerBonus: d.topScorerBonus,
        },
      },
      prizeTiers: {
        create: d.prizeTiers.map((t) => ({
          position: t.position,
          percentage: t.percentage,
        })),
      },
      memberships: {
        create: { userId, role: "OWNER", paid: true },
      },
      invites: {
        create: { code: inviteCode() },
      },
      feedEvents: {
        create: { type: "POOL_CREATED", userId, payload: { name: d.name } },
      },
    },
  });

  revalidatePath("/");
  return { ok: true, data: { slug: pool.slug } };
}

/** Entrar em um bolão via código de convite. */
export async function joinPool(
  input: unknown,
): Promise<ActionResult<{ slug: string }>> {
  const userId = await requireUserId();
  const parsed = joinPoolSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Código inválido" };

  const code = parsed.data.code.trim().toUpperCase();
  const invite = await db.invite.findUnique({
    where: { code },
    include: { pool: true },
  });
  if (!invite) return { ok: false, error: "Convite não encontrado" };
  if (invite.expiresAt && invite.expiresAt < new Date())
    return { ok: false, error: "Convite expirado" };
  if (invite.maxUses != null && invite.uses >= invite.maxUses)
    return { ok: false, error: "Convite esgotado" };

  const already = await db.membership.findUnique({
    where: { userId_poolId: { userId, poolId: invite.poolId } },
  });
  if (already) return { ok: true, data: { slug: invite.pool.slug } };

  await db.$transaction([
    db.membership.create({
      data: { userId, poolId: invite.poolId, role: "MEMBER" },
    }),
    db.invite.update({ where: { id: invite.id }, data: { uses: { increment: 1 } } }),
    db.feedEvent.create({
      data: { poolId: invite.poolId, type: "JOINED", userId, payload: {} },
    }),
  ]);

  revalidatePath("/");
  return { ok: true, data: { slug: invite.pool.slug } };
}
