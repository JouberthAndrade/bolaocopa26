import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { manualResultsBodySchema } from "@/lib/manual-result";
import { applyManualResults } from "@/server/services/manual-result";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Lançamento MANUAL de resultado (via Postman/cron-job.org). Protegido pelo
 * mesmo Bearer dos crons. Marca o(s) jogo(s) como FINISHED com o placar dado e
 * dispara a pontuação. Use quando a fonte automática não trouxe o placar.
 *
 * POST /api/admin/set-result
 * Headers: Authorization: Bearer <CRON_SECRET>, Content-Type: application/json
 * Body (um jogo):    { "externalId": "537327", "homeScore": 2, "awayScore": 0 }
 * Body (por código): { "homeCode": "mx", "awayCode": "za", "homeScore": 2, "awayScore": 0 }
 * Body (vários):     { "results": [ {…}, {…} ] }
 */
export async function POST(req: Request) {
  const header = req.headers.get("authorization");
  if (header !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const parsed = manualResultsBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Body inválido" },
      { status: 400 },
    );
  }

  try {
    const result = await applyManualResults(parsed.data);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[admin/set-result]", err);
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
