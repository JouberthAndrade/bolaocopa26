import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { syncFromProvider } from "@/server/services/sync";
import { scoreFinishedMatches } from "@/server/services/scoring";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const header = req.headers.get("authorization");
  // Vercel Cron envia: Authorization: Bearer <CRON_SECRET>
  return header === `Bearer ${env.CRON_SECRET}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // A Copa só começa em 12/06/2026. Antes da data de início do polling não há
  // o que sincronizar nem pontuar — retorna cedo para não gastar quota da API.
  // (O Vercel Cron não suporta data de início; o gate fica aqui, na rota.)
  const now = new Date();
  const pollingStart = new Date(env.POLLING_START);
  if (now < pollingStart) {
    return NextResponse.json({
      ok: true,
      skipped: "before-polling-start",
      pollingStart: pollingStart.toISOString(),
    });
  }

  try {
    const sync = await syncFromProvider();
    // Sempre roda o scoring na sequência: além de pontuar jogos recém-finalizados,
    // funciona como rede de segurança para jogos FINISHED que ficaram sem pontuar
    // num tick anterior (ex.: erro pontual). Custo é desprezível quando não há
    // nada a pontuar (apenas 1 SELECT com scored=false vazio). Um único cron
    // executa este caminho → sem sobreposição de jobs, sem corrida no ranking.
    const scoring = await scoreFinishedMatches();
    return NextResponse.json({ ok: true, sync, scoring });
  } catch (err) {
    console.error("[cron/sync-matches]", err);
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
