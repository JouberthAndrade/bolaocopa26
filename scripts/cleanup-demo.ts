/**
 * Limpeza de dados de teste (mock) e normalização de grupos.
 *
 * 1. Remove times/jogos seedados manualmente (externalId "demo-*").
 *    Os bets associados são apagados em cascata (Bet.match onDelete: Cascade).
 * 2. Normaliza grupos legados gravados como "GROUP_A" → "A".
 * 3. Recalcula o ranking de todos os bolões (corrige totalPoints após remover
 *    os palpites dos jogos fantasmas).
 *
 * Uso: npm run db:cleanup-demo   (idempotente — pode rodar quantas vezes quiser)
 */
import { db } from "@/lib/db";
import { normalizeGroup } from "@/lib/group";
import { recalcPoolStandings } from "@/server/services/scoring";

async function main() {
  console.log("🧹 Limpeza de dados de teste iniciando…");

  // 1) Apaga jogos e times mockados (cascade nos bets).
  const delMatches = await db.match.deleteMany({
    where: { externalId: { startsWith: "demo-" } },
  });
  const delTeams = await db.team.deleteMany({
    where: { externalId: { startsWith: "demo-" } },
  });
  console.log(`   • Jogos demo removidos: ${delMatches.count}`);
  console.log(`   • Times demo removidos: ${delTeams.count}`);

  // 2) Normaliza grupos legados ("GROUP_A" → "A") em jogos e times.
  let normalized = 0;
  const matchGroups = await db.match.findMany({
    where: { group: { not: null } },
    distinct: ["group"],
    select: { group: true },
  });
  for (const { group } of matchGroups) {
    const norm = normalizeGroup(group!);
    if (norm !== group) {
      const r = await db.match.updateMany({ where: { group }, data: { group: norm } });
      normalized += r.count;
    }
  }
  const teamGroups = await db.team.findMany({
    where: { group: { not: null } },
    distinct: ["group"],
    select: { group: true },
  });
  for (const { group } of teamGroups) {
    const norm = normalizeGroup(group!);
    if (norm !== group) {
      const r = await db.team.updateMany({ where: { group }, data: { group: norm } });
      normalized += r.count;
    }
  }
  console.log(`   • Registros com grupo normalizado: ${normalized}`);

  // 3) Recalcula ranking de todos os bolões.
  const pools = await db.pool.findMany({ select: { id: true } });
  for (const p of pools) await recalcPoolStandings(p.id);
  console.log(`   • Rankings recalculados: ${pools.length}`);

  console.log("✅ Limpeza concluída.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
