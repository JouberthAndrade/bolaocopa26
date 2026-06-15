import { redirect } from "next/navigation";
import { requireUserId } from "@/server/guards";
import { getUserPools } from "@/server/services/matches";

export const dynamic = "force-dynamic";

/**
 * Índice de "/b": resolve o bolão do usuário e redireciona para o ranking dele
 * (/b/[slug]). Usado pelo item "Ranking" da navegação, que não tem o slug em
 * mãos. Sem bolão, manda para a tela de bolões.
 */
export default async function RankingIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ pool?: string }>;
}) {
  const userId = await requireUserId();
  const { pool: poolSlug } = await searchParams;
  const pools = await getUserPools(userId);

  if (pools.length === 0) redirect("/pools");

  const selected = pools.find((p) => p.slug === poolSlug) ?? pools[0];
  redirect(`/b/${selected.slug}`);
}
