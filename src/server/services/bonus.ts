import { db } from "@/lib/db";
import { BONUS_DEADLINE } from "@/lib/constants";

export type BonusKey = "champion" | "runnerUp" | "topScorer";

export interface BonusItem {
  key: BonusKey;
  label: string;
  /** Descrição curta do que o usuário precisa palpitar. */
  hint: string;
  bonus: number;
  filled: boolean;
}

export interface BonusStatus {
  /** Palpite ainda pode ser enviado/editado (antes do entryDeadline). */
  open: boolean;
  deadline: Date | null;
  items: BonusItem[];
  /** Quantos itens ainda faltam preencher. */
  pendingCount: number;
  current: {
    champTeamId: string | null;
    runnerUpTeamId: string | null;
    topScorerName: string | null;
  };
}

/**
 * Calcula as pendências de palpites-bônus (campeão / vice / artilheiro) do
 * usuário em um bolão, conforme as regras configuradas (bônus > 0).
 * O placar dos confrontos NÃO entra aqui — só os palpites de longo prazo.
 */
export async function getBonusStatus(opts: {
  userId: string;
  poolId: string;
}): Promise<BonusStatus> {
  const [pool, bet] = await Promise.all([
    db.pool.findUnique({
      where: { id: opts.poolId },
      select: { entryDeadline: true, scoringRule: true },
    }),
    db.championBet.findUnique({
      where: { userId_poolId: { userId: opts.userId, poolId: opts.poolId } },
      select: { champTeamId: true, runnerUpTeamId: true, topScorerName: true },
    }),
  ]);

  const rule = pool?.scoringRule;
  const deadline = pool?.entryDeadline ?? BONUS_DEADLINE;
  const open = new Date() < deadline;

  const current = {
    champTeamId: bet?.champTeamId ?? null,
    runnerUpTeamId: bet?.runnerUpTeamId ?? null,
    topScorerName: bet?.topScorerName ?? null,
  };

  const items: BonusItem[] = [];
  if ((rule?.championBonus ?? 0) > 0) {
    items.push({
      key: "champion",
      label: "Campeão",
      hint: "Quem levanta a taça?",
      bonus: rule!.championBonus,
      filled: !!current.champTeamId,
    });
  }
  if ((rule?.runnerUpBonus ?? 0) > 0) {
    items.push({
      key: "runnerUp",
      label: "Vice-campeão",
      hint: "O outro finalista (define o jogo da final)",
      bonus: rule!.runnerUpBonus,
      filled: !!current.runnerUpTeamId,
    });
  }
  if ((rule?.topScorerBonus ?? 0) > 0) {
    items.push({
      key: "topScorer",
      label: "Artilheiro",
      hint: "O maior goleador do torneio",
      bonus: rule!.topScorerBonus,
      filled: !!current.topScorerName,
    });
  }

  const pendingCount = open ? items.filter((i) => !i.filled).length : 0;

  return { open, deadline, items, pendingCount, current };
}
