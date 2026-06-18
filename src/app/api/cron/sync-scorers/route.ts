import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { syncTopScorers } from "@/server/services/top-scorers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Sincroniza a artilharia da Copa a partir da API-Football.
 * Disparado por cron externo (cron-job.org), 3x/dia.
 *
 * Protegido por `Authorization: Bearer <CRON_SECRET>`. Em erro na API externa
 * devolve 500 sem apagar os dados já existentes.
 */
export async function POST(req: Request) {
  const header = req.headers.get("authorization");
  if (header !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncTopScorers();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("[cron/sync-scorers]", err);
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
