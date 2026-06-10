/**
 * Cria/atualiza os dois bots de IA (Claudinho e Gepeto), os coloca em TODOS os
 * bolões e carrega seus palpites a partir de docs/claudinho.json e docs/gepeto.json.
 *
 * Idempotente — pode rodar a cada rodada. Uso: npm run seed:bots
 *
 * Regras importantes:
 * - Os palpites só aparecem na aba Confronto após o jogo terminar (regra herdada
 *   de getMatchupDetail: revela após lockAt e só para jogos FINISHED).
 * - Os bots NÃO contam como participantes pagantes (filtrados nas contagens via
 *   user.isBot), mas COMPETEM no ranking — suas bets são pontuadas normalmente.
 * - Casa fixtures por par de seleções (ignora round/date, pouco confiáveis no
 *   gepeto.json). Fixtures sem Match correspondente no DB são reportados.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { BotKind } from "@prisma/client";
import { db } from "../src/lib/db";
import { scoreFinishedMatches } from "../src/server/services/scoring";
import { teamCode } from "../src/lib/team-name";

interface PalpiteEntry {
  team1: string;
  team2: string;
  score_team1: number;
  score_team2: number;
}

interface BotDef {
  name: string;
  email: string;
  botKind: BotKind;
  file: string;
}

const BOTS: BotDef[] = [
  { name: "Claudinho", email: "claudinho@bot.bolao", botKind: "CLAUDINHO", file: "claudinho.json" },
  { name: "Gepeto", email: "gepeto@bot.bolao", botKind: "GEPETO", file: "gepeto.json" },
];

/** Lê o JSON do bot, aceitando tanto `{ matches: [...] }` quanto array puro. */
function loadPalpites(file: string): PalpiteEntry[] {
  const raw = JSON.parse(readFileSync(join(process.cwd(), "docs", file), "utf8"));
  const arr: unknown = Array.isArray(raw) ? raw : raw.matches;
  if (!Array.isArray(arr)) throw new Error(`Formato inesperado em docs/${file}`);
  return arr as PalpiteEntry[];
}

/** Chave não-ordenada do confronto por código ISO das seleções. */
const codePairKey = (a: string, b: string) => [a, b].sort().join("|");

interface IndexedMatch {
  matchId: string;
  homeCode: string;
  finished: boolean;
}

async function main() {
  console.log("🤖 Seed dos bots Claudinho e Gepeto…");

  const pools = await db.pool.findMany({ select: { id: true, tournamentId: true } });
  if (pools.length === 0) {
    console.log("⚠️  Nenhum bolão encontrado. Nada a fazer.");
    return;
  }

  // Índice de jogos por torneio: par de códigos ISO (não-ordenado) -> jogo.
  const allMatches = await db.match.findMany({
    select: {
      id: true,
      tournamentId: true,
      status: true,
      homeTeam: { select: { countryCode: true } },
      awayTeam: { select: { countryCode: true } },
    },
  });
  const indexByTournament = new Map<string, Map<string, IndexedMatch>>();
  for (const m of allMatches) {
    if (!indexByTournament.has(m.tournamentId)) {
      indexByTournament.set(m.tournamentId, new Map());
    }
    indexByTournament
      .get(m.tournamentId)!
      .set(codePairKey(m.homeTeam.countryCode, m.awayTeam.countryCode), {
        matchId: m.id,
        homeCode: m.homeTeam.countryCode,
        finished: m.status === "FINISHED",
      });
  }

  const finishedToRescore = new Set<string>();

  for (const bot of BOTS) {
    const palpites = loadPalpites(bot.file);

    const user = await db.user.upsert({
      where: { email: bot.email },
      update: { name: bot.name, isBot: true, botKind: bot.botKind },
      create: { name: bot.name, email: bot.email, isBot: true, botKind: bot.botKind },
    });

    let bets = 0;
    const unmatched = new Set<string>();

    for (const pool of pools) {
      // Garante a participação do bot no bolão.
      await db.membership.upsert({
        where: { userId_poolId: { userId: user.id, poolId: pool.id } },
        update: {},
        create: { userId: user.id, poolId: pool.id, role: "MEMBER", paid: true },
      });

      const matchIndex = indexByTournament.get(pool.tournamentId);
      if (!matchIndex) continue;

      for (const p of palpites) {
        const code1 = teamCode(p.team1);
        const code2 = teamCode(p.team2);
        if (!code1 || !code2) {
          unmatched.add(`${p.team1} x ${p.team2} (sem código ISO)`);
          continue;
        }
        const hit = matchIndex.get(codePairKey(code1, code2));
        if (!hit) {
          unmatched.add(`${p.team1} x ${p.team2}`);
          continue;
        }
        // Respeita a orientação real do jogo no DB.
        const sameOrientation = hit.homeCode === code1;
        const homeGuess = sameOrientation ? p.score_team1 : p.score_team2;
        const awayGuess = sameOrientation ? p.score_team2 : p.score_team1;

        await db.bet.upsert({
          where: {
            userId_poolId_matchId: {
              userId: user.id,
              poolId: pool.id,
              matchId: hit.matchId,
            },
          },
          update: { homeGuess, awayGuess },
          create: { userId: user.id, poolId: pool.id, matchId: hit.matchId, homeGuess, awayGuess },
        });
        bets++;
        if (hit.finished) finishedToRescore.add(hit.matchId);
      }
    }

    console.log(
      `  ✓ ${bot.name}: ${bets} palpite(s) em ${pools.length} bolão(ões)` +
        (unmatched.size > 0
          ? `\n    ⚠️  ${unmatched.size} fixture(s) sem jogo no DB: ${[...unmatched].join(", ")}`
          : ""),
    );
  }

  // Re-pontua jogos já finalizados que receberam bets de bot (scoring é idempotente
  // por Match.scored; reabrimos os afetados para incluir os bots no ranking).
  if (finishedToRescore.size > 0) {
    await db.match.updateMany({
      where: { id: { in: [...finishedToRescore] } },
      data: { scored: false },
    });
    const res = await scoreFinishedMatches();
    console.log(`🧮 Re-pontuação: ${res.scoredMatches} jogo(s), ${res.affectedPools} bolão(ões).`);
  }

  console.log("✅ Bots prontos.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
