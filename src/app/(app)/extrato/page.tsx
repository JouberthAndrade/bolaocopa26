import Link from "next/link";
import { Receipt } from "lucide-react";
import { requireUserId } from "@/server/guards";
import { getUserPools, getAllMatchesWithBets } from "@/server/services/matches";
import { classifyBet } from "@/lib/bet-result";
import { MatchCard } from "@/components/match/match-card";
import { PoolSelector } from "@/components/pool/pool-selector";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function ExtratoPage({
  searchParams,
}: {
  searchParams: Promise<{ pool?: string }>;
}) {
  const userId = await requireUserId();
  const { pool: poolSlug } = await searchParams;
  const pools = await getUserPools(userId);

  if (pools.length === 0) {
    return (
      <Card>
        <CardContent className="space-y-4 py-10 text-center">
          <div className="text-5xl">🧾</div>
          <h2 className="text-lg font-semibold">Entre em um bolão para palpitar</h2>
          <p className="text-sm text-muted-foreground">
            O extrato mostra os jogos que você já palpitou e a pontuação de cada um.
          </p>
          <div className="flex justify-center gap-2">
            <Link href="/pool/new" className={buttonVariants()}>Criar bolão</Link>
            <Link href="/pools" className={buttonVariants({ variant: "outline" })}>
              Entrar com código
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  const selected = pools.find((p) => p.slug === poolSlug) ?? pools[0];
  const matches = await getAllMatchesWithBets({ userId, poolId: selected.id });

  // Só os jogos que o jogador palpitou.
  const betted = matches.filter((m) => m.bet);

  // Resumo do extrato: pontos e contagem por tipo de acerto.
  let totalPoints = 0;
  let exact = 0;
  let result = 0;
  let miss = 0;
  for (const m of betted) {
    const r = classifyBet(
      { home: m.bet!.homeGuess, away: m.bet!.awayGuess },
      { home: m.homeScore, away: m.awayScore, finished: m.status === "FINISHED" },
    );
    if (r.kind === "EXACT") exact++;
    else if (r.kind === "RESULT") result++;
    else if (r.kind === "MISS") miss++;
    if (m.status === "FINISHED") totalPoints += m.bet!.pointsEarned ?? 0;
  }
  const pending = betted.length - exact - result - miss;

  // Finalizados/ao vivo mais recentes primeiro; futuros, o mais próximo primeiro.
  const played = betted
    .filter((m) => m.status !== "SCHEDULED")
    .sort((a, b) => +new Date(b.kickoffAt) - +new Date(a.kickoffAt));
  const upcoming = betted
    .filter((m) => m.status === "SCHEDULED")
    .sort((a, b) => +new Date(a.kickoffAt) - +new Date(b.kickoffAt));

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Extrato</h1>
          <p className="text-sm text-muted-foreground">
            Seus palpites e pontos jogo a jogo · {selected.name}
          </p>
        </div>
        <PoolSelector pools={pools} current={selected.slug} basePath="/extrato" />
      </div>

      {betted.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 py-10 text-center text-sm text-muted-foreground">
            <Receipt className="mx-auto h-8 w-8" />
            <p>Você ainda não palpitou em nenhum jogo neste bolão.</p>
            <Link href="/" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Fazer palpites
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Resumo */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <SummaryStat label="Pontos" value={totalPoints} highlight />
            <SummaryStat label="Placar exato" value={exact} />
            <SummaryStat label="Resultado" value={result} />
            <SummaryStat label="Não pontuou" value={miss} />
            <SummaryStat label="Aguardando" value={pending} />
          </div>

          {played.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground">
                Jogos disputados ({played.length})
              </h2>
              {played.map((m) => (
                <MatchCard key={m.id} match={m} poolId={selected.id} />
              ))}
            </section>
          )}

          {upcoming.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground">
                Palpites registrados — aguardando jogo ({upcoming.length})
              </h2>
              {upcoming.map((m) => (
                <MatchCard key={m.id} match={m} poolId={selected.id} />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function SummaryStat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card px-3 py-2 text-center">
      <div className={highlight ? "text-xl font-bold text-primary" : "text-xl font-bold"}>
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
