/**
 * Migração da regra de pontuação (sem apagar nada do banco).
 *
 * Nova regra:
 *   • Placar exato: 3 pts (vitória ou empate)
 *   • Acertou o resultado (vencedor ou empate, sem placar exato): 2 pts
 *
 * Na ScoringRule isso vira: pointsCorrectResult=2, pointsCorrectDraw=2,
 * pointsExactScore=1 (bônus) → exato = 2 + 1 = 3.
 *
 * Passos (idempotente — pode rodar quantas vezes quiser):
 * 1. Atualiza todas as ScoringRule existentes para os novos valores.
 * 2. Marca os jogos finalizados como scored=false para forçar repontuação.
 * 3. Roda scoreFinishedMatches(), que recalcula Bet.pointsEarned e os
 *    totalPoints das memberships (ranking) dos bolões afetados.
 *
 * Uso: npm run db:update-scoring   (aponte DATABASE_URL para produção)
 */
import { db } from "@/lib/db";
import { scoreFinishedMatches } from "@/server/services/scoring";

const NEW_RULE = {
  pointsCorrectResult: 2,
  pointsCorrectDraw: 2,
  pointsExactScore: 1,
};

async function main() {
  console.log("🏆 Migração da regra de pontuação iniciando…");

  // 1) Atualiza as regras de todos os bolões existentes.
  const rules = await db.scoringRule.updateMany({ data: NEW_RULE });
  console.log(`   • ScoringRules atualizadas: ${rules.count}`);

  // 2) Força repontuação dos jogos já finalizados.
  const reset = await db.match.updateMany({
    where: { status: "FINISHED", scored: true },
    data: { scored: false },
  });
  console.log(`   • Jogos finalizados marcados para repontuar: ${reset.count}`);

  // 3) Repontua palpites e recalcula ranking (totalPoints) dos bolões.
  const result = await scoreFinishedMatches();
  console.log(
    `   • Jogos repontuados: ${result.scoredMatches} | Bolões com ranking recalculado: ${result.affectedPools}`,
  );

  console.log("✅ Migração concluída.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
