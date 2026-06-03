import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { scoreFinishedMatches } from "@/server/services/scoring";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const header = req.headers.get("authorization");
  if (header !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await scoreFinishedMatches();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/score]", err);
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
