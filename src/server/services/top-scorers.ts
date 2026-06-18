import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import type { Element } from "domhandler";
import { db } from "@/lib/db";

// Artilharia da Copa via scraping da página pública da ESPN.
// A página renderiza no servidor duas tabelas: "Top Scorers" (RK/Name/Team/P/G)
// e "Top Assists" (RK/Name/Team/P/A). A tela NUNCA acessa a ESPN — só o cron.
const ESPN_URL = "https://www.espn.com/soccer/stats/_/league/FIFA.WORLD";
const TOP_N = 20;

export interface SyncScorersResult {
  count: number;
  syncedAt: string;
}

interface ParsedRow {
  /** id estável do jogador na ESPN (ex.: "s:600~a:45843") — chave do merge */
  uid: string;
  playerName: string;
  teamName: string;
  appearances: number;
  /** estatística da última coluna: gols (tabela de artilheiros) ou assistências */
  stat: number;
}

/** Extrai as linhas de uma tabela de stats da ESPN. */
function parseStatsTable($: CheerioAPI, table: Element): ParsedRow[] {
  const out: ParsedRow[] = [];
  $(table)
    .find("tbody tr")
    .each((_, tr) => {
      const tds = $(tr).find("td");
      if (tds.length < 5) return;
      const playerAnchor = $(tds[1]).find("a");
      const playerName = playerAnchor.text().trim();
      if (!playerName) return;
      out.push({
        uid: playerAnchor.attr("data-player-uid") ?? "",
        playerName,
        teamName: $(tds[2]).find("a").text().trim(),
        appearances: Number.parseInt($(tds[3]).text().trim(), 10) || 0,
        stat: Number.parseInt($(tds[4]).text().trim(), 10) || 0,
      });
    });
  return out;
}

/**
 * Faz scraping dos top marcadores na ESPN e sincroniza a tabela `TopScorer` por
 * UPSERT (jogador existente é atualizado, novo é inserido, quem caiu do top N é
 * removido) — tudo numa transação. Em caso de erro de rede ou HTML inesperado
 * lança: o chamador (rota) devolve 500 e os dados existentes ficam intactos.
 * ESPN não expõe foto/bandeira via scraping: esses campos ficam "".
 */
export async function syncTopScorers(): Promise<SyncScorersResult> {
  const res = await fetch(ESPN_URL, {
    // Headers de browser para evitar bloqueio do scraper.
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ESPN ${res.status} ${res.statusText} ${body}`.trim());
  }

  const $ = cheerio.load(await res.text());
  const tables = $("table.Table").toArray();
  if (tables.length === 0) {
    throw new Error("ESPN: tabela de estatísticas não encontrada (HTML mudou?)");
  }

  // 1ª tabela = artilheiros (gols); 2ª (quando existe) = assistências.
  const scorers = parseStatsTable($, tables[0]);
  if (scorers.length === 0) {
    throw new Error("ESPN: nenhum artilheiro encontrado (HTML inesperado?)");
  }

  const assists =
    tables.length > 1 ? parseStatsTable($, tables[1]) : ([] as ParsedRow[]);
  const assistsByPlayer = new Map(
    assists.map((a) => [a.uid || a.playerName, a.stat]),
  );

  const rows = scorers.slice(0, TOP_N).map((s, index) => ({
    // id estável do jogador (uid da ESPN); fallback nome|time se vier vazio.
    externalId: s.uid || `${s.playerName}|${s.teamName}`,
    playerName: s.playerName,
    playerPhoto: "", // ESPN não expõe foto via scraping
    nationality: "", // idem
    teamName: s.teamName,
    teamLogo: "", // idem
    goals: s.stat,
    assists: assistsByPlayer.get(s.uid || s.playerName) ?? 0,
    appearances: s.appearances,
    position: index + 1,
  }));

  // Só mexe no banco se o scraping rendeu algo — evita apagar tudo num retorno vazio.
  if (rows.length > 0) {
    const currentIds = rows.map((r) => r.externalId);
    await db.$transaction([
      // UPSERT por jogador: existente é atualizado (mantém id/createdAt; gols,
      // partidas e posição mudam ao longo do torneio); novo é inserido.
      ...rows.map((row) => {
        const { externalId, ...rest } = row;
        return db.topScorer.upsert({
          where: { externalId },
          update: rest,
          create: row,
        });
      }),
      // Remove quem saiu do top N para a lista não acumular registros obsoletos.
      db.topScorer.deleteMany({ where: { externalId: { notIn: currentIds } } }),
    ]);
  }

  return { count: rows.length, syncedAt: new Date().toISOString() };
}

export interface TopScorerRow {
  id: number;
  playerName: string;
  playerPhoto: string;
  teamName: string;
  teamLogo: string;
  nationality: string;
  goals: number;
  assists: number;
  appearances: number;
  position: number;
}

export interface TopScorersPayload {
  data: TopScorerRow[];
  lastSync: string | null;
}

/** Leitura direta do banco, ordenada por posição. Sem cache. */
export async function getTopScorers(): Promise<TopScorersPayload> {
  const rows = await db.topScorer.findMany({
    orderBy: { position: "asc" },
  });

  return {
    data: rows.map((r) => ({
      id: r.id,
      playerName: r.playerName,
      playerPhoto: r.playerPhoto,
      teamName: r.teamName,
      teamLogo: r.teamLogo,
      nationality: r.nationality,
      goals: r.goals,
      assists: r.assists,
      appearances: r.appearances,
      position: r.position,
    })),
    lastSync: rows[0]?.updatedAt.toISOString() ?? null,
  };
}
