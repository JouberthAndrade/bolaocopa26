import { auth } from "@/auth";
import { db } from "@/lib/db";
import type { Role } from "@prisma/client";

export async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("UNAUTHENTICATED");
  return session.user.id;
}

/** Garante que o usuário é membro do bolão e retorna seu papel. */
export async function requireMembership(
  poolId: string,
  userId: string,
): Promise<Role> {
  const membership = await db.membership.findUnique({
    where: { userId_poolId: { userId, poolId } },
    select: { role: true },
  });
  if (!membership) throw new Error("FORBIDDEN");
  return membership.role;
}

export function assertAdmin(role: Role) {
  if (role !== "OWNER" && role !== "ADMIN") throw new Error("FORBIDDEN");
}
