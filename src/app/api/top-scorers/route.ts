import { NextResponse } from "next/server";
import { getTopScorers } from "@/server/services/top-scorers";

export const dynamic = "force-dynamic";

/**
 * Leitura da artilharia direto do banco (sem cache HTTP).
 * A tela consome esta rota; nunca chama a API-Football.
 */
export async function GET() {
  try {
    const payload = await getTopScorers();
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[top-scorers]", err);
    return NextResponse.json(
      { data: [], lastSync: null, error: (err as Error).message },
      { status: 500 },
    );
  }
}
