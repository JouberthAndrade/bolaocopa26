import type { BotKind } from "@prisma/client";
import { db } from "@/lib/db";
import { bonusDeadlineFor } from "@/lib/constants";

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
  const deadline = bonusDeadlineFor(pool?.entryDeadline);
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

export interface BonusMatchupRow {
  userId: string;
  name: string | null;
  image: string | null;
  isBot: boolean;
  botKind: BotKind | null;
  champ: { name: string; countryCode: string } | null;
  runnerUp: { name: string; countryCode: string } | null;
  topScorer: string | null;
}

/** Ordem fixa dos bots na seção de IA (mesma do Confronto de jogos). */
const BOT_ORDER: BotKind[] = ["CLAUDINHO", "GEPETO"];

/**
 * Palpites de bônus (campeão/vice/artilheiro) de TODOS os participantes do
 * bolão. Só revela depois do prazo efetivo (bonusDeadlineFor) — antes disso
 * retorna null, para ninguém copiar palpite alheio.
 */
export async function getBonusMatchup(poolId: string): Promise<BonusMatchupRow[] | null> {
  const pool = await db.pool.findUnique({
    where: { id: poolId },
    select: { entryDeadline: true },
  });
  if (!pool) return null;
  if (new Date() < bonusDeadlineFor(pool.entryDeadline)) return null; // ainda não revela

  const [memberships, bets, teams] = await Promise.all([
    db.membership.findMany({
      where: { poolId },
      select: {
        userId: true,
        user: { select: { name: true, image: true, isBot: true, botKind: true } },
      },
    }),
    db.championBet.findMany({
      where: { poolId },
      select: { userId: true, champTeamId: true, runnerUpTeamId: true, topScorerName: true },
    }),
    db.team.findMany({ select: { id: true, name: true, countryCode: true } }),
  ]);

  const teamById = new Map(teams.map((t) => [t.id, { name: t.name, countryCode: t.countryCode }]));
  const betByUser = new Map(bets.map((b) => [b.userId, b]));

  const rows: BonusMatchupRow[] = memberships.map((m) => {
    const b = betByUser.get(m.userId);
    return {
      userId: m.userId,
      name: m.user.name,
      image: m.user.image,
      isBot: m.user.isBot,
      botKind: m.user.botKind,
      champ: b?.champTeamId ? teamById.get(b.champTeamId) ?? null : null,
      runnerUp: b?.runnerUpTeamId ? teamById.get(b.runnerUpTeamId) ?? null : null,
      topScorer: b?.topScorerName ?? null,
    };
  });

  // Bots primeiro (ordem fixa), depois humanos por nome.
  return rows.sort((a, b) => {
    if (a.isBot !== b.isBot) return a.isBot ? -1 : 1;
    if (a.isBot && b.isBot) {
      const ai = a.botKind ? BOT_ORDER.indexOf(a.botKind) : BOT_ORDER.length;
      const bi = b.botKind ? BOT_ORDER.indexOf(b.botKind) : BOT_ORDER.length;
      return ai - bi;
    }
    return (a.name ?? "").localeCompare(b.name ?? "", "pt-BR");
  });
}
