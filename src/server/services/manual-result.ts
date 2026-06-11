import { db } from "@/lib/db";
import { scoreFinishedMatches } from "@/server/services/scoring";
import type { ManualResultInput } from "@/lib/manual-result";

export interface AppliedResult {
  matchId: string;
  externalId: string;
  homeScore: number;
  awayScore: number;
}

export interface ManualResultOutcome {
  applied: AppliedResult[];
  notFound: ManualResultInput[];
  scoring: Awaited<ReturnType<typeof scoreFinishedMatches>>;
}

/**
 * Lança manualmente o placar final de um ou mais jogos: grava o placar, marca
 * como FINISHED e força a (re)pontuação (`scored = false`). Em seguida roda o
 * scoring normal — que pontua os palpites e recalcula o ranking dos bolões.
 *
 * Útil quando a fonte automática (Football-Data) marca o jogo como FINISHED mas
 * ainda não publicou o placar (`score.fullTime` null), ou quando a API ao vivo
 * está sem quota. Idempotente: rodar de novo com o mesmo placar não muda nada.
 */
export async function applyManualResults(
  inputs: ManualResultInput[],
): Promise<ManualResultOutcome> {
  const applied: AppliedResult[] = [];
  const notFound: ManualResultInput[] = [];

  for (const r of inputs) {
    let match: { id: string; externalId: string } | null = null;

    if (r.externalId) {
      match = await db.match.findUnique({
        where: { externalId: r.externalId },
        select: { id: true, externalId: true },
      });
    } else if (r.homeCode && r.awayCode) {
      // Par de códigos ISO: pega o jogo mais recente desse confronto.
      const candidates = await db.match.findMany({
        where: {
          homeTeam: { countryCode: r.homeCode },
          awayTeam: { countryCode: r.awayCode },
        },
        orderBy: { kickoffAt: "desc" },
        select: { id: true, externalId: true },
        take: 1,
      });
      match = candidates[0] ?? null;
    }

    if (!match) {
      notFound.push(r);
      continue;
    }

    await db.match.update({
      where: { id: match.id },
      data: {
        homeScore: r.homeScore,
        awayScore: r.awayScore,
        status: "FINISHED",
        scored: false, // força o scoring a (re)pontuar este jogo
      },
    });
    applied.push({
      matchId: match.id,
      externalId: match.externalId,
      homeScore: r.homeScore,
      awayScore: r.awayScore,
    });
  }

  // Pontua os jogos recém-finalizados e recalcula o ranking dos bolões afetados.
  const scoring = await scoreFinishedMatches();

  return { applied, notFound, scoring };
}
