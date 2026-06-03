/**
 * Sincroniza times e jogos da Football-Data manualmente.
 * Uso: npm run sync:matches   (requer FOOTBALL_DATA_TOKEN no .env)
 */
import { syncFromProvider } from "../src/server/services/sync";
import { scoreFinishedMatches } from "../src/server/services/scoring";

async function main() {
  console.log("⏳ Sincronizando da Football-Data (competição 2000)…");
  const sync = await syncFromProvider();
  console.log("✅ Sync:", sync);
  if (sync.newlyFinished > 0) {
    const scoring = await scoreFinishedMatches();
    console.log("🧮 Pontuação:", scoring);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
