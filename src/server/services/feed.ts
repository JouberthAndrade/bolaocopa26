import { db } from "@/lib/db";

export async function getFeed(poolId: string, limit = 30) {
  return db.feedEvent.findMany({
    where: { poolId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { name: true, image: true } } },
  });
}
