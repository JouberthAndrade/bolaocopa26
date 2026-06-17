import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { updateLiveScores } from "@/server/services/live-score";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Atualização de placar AO VIVO via API pública da ESPN.
 * Disparado por cron externo (cron-job.org). Faz 1 request por chamada
 * (sem chave / sem limite de quota).
 *
 * Só atualiza placar e status LIVE; NÃO finaliza jogos nem pontua o bolão
 * (isso fica com o cron de sync+score).
 */
export async function GET(req: Request) {
  const header = req.headers.get("authorization");
  if (header !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Antes do início do torneio não há jogo ao vivo — economiza quota da API.
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
    const result = await updateLiveScores();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/live-score]", err);
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
