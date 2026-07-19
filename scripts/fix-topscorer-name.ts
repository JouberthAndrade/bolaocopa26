/**
 * Corrige palpites de artilheiro salvos com variações/erros de digitação do
 * nome real (ex.: "Mbapee" em vez de "Kylian Mbappé") — normaliza para o nome
 * canônico gravado em TopScorer (posição 1) e repontua os bônus na sequência.
 *
 * Por que precisa disso: scoreChampionBonuses() (ver scoring.ts) já usa
 * matchesTopScorerGuess(), que tolera sobrenome/acento/erro de digitação —
 * então o próximo tick do cron já pontuaria certo sozinho. Este script só
 * adianta a repontuação e deixa o texto salvo consistente com o nome oficial
 * (bom para exibição no ranking/extrato, que mostra o palpite como digitado).
 *
 * Idempotente — pode rodar quantas vezes quiser.
 *
 * Uso (aponte DATABASE_URL para produção):
 *   npm run db:fix-topscorer-name                → corrige todos os bolões
 *   npm run db:fix-topscorer-name -- --dry-run    → só mostra, não grava
 */
import { db } from "@/lib/db";
import {
  matchesTopScorerGuess,
  resolveTournamentBonusWinners,
  scoreChampionBonuses,
} from "@/server/services/scoring";

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const tournaments = await db.tournament.findMany({ select: { id: true, name: true } });

  let checked = 0;
  let fixed = 0;

  for (const tournament of tournaments) {
    const winners = await resolveTournamentBonusWinners(tournament.id);
    if (!winners?.topScorerName) continue; // Final ainda não decidiu, ou sem artilheiro sincronizado

    const bets = await db.championBet.findMany({
      where: { pool: { tournamentId: tournament.id }, topScorerName: { not: null } },
      select: {
        id: true,
        topScorerName: true,
        user: { select: { name: true, email: true } },
        pool: { select: { slug: true } },
      },
    });

    for (const bet of bets) {
      checked++;
      const guess = bet.topScorerName!;
      if (guess === winners.topScorerName) continue; // já está com o nome exato
      if (!matchesTopScorerGuess(guess, winners.topScorerName)) continue; // não é o mesmo jogador

      console.log(
        `   • ${bet.user.name ?? bet.user.email} (${bet.pool.slug}): "${guess}" → "${winners.topScorerName}"`,
      );
      fixed++;
      if (!dryRun) {
        await db.championBet.update({
          where: { id: bet.id },
          data: { topScorerName: winners.topScorerName },
        });
      }
    }
  }

  console.log(`\n🔍 Palpites de artilheiro conferidos: ${checked} | corrigidos: ${fixed}`);

  if (dryRun) {
    console.log("(dry-run: nada foi gravado, bônus não repontuado)");
    return;
  }

  if (fixed > 0) {
    const bonus = await scoreChampionBonuses();
    console.log(
      `✅ Bônus repontuado — palpites atualizados: ${bonus.updatedBets} | bolões com ranking recalculado: ${bonus.affectedPools}`,
    );
  } else {
    console.log("Nada para repontuar.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
