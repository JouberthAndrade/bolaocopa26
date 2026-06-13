# Ranking — Modal de Extrato por Participante — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar cada linha do ranking clicável, abrindo um modal que exibe os jogos finalizados em que aquele participante palpitou (palpite, resultado real e pontos).

**Architecture:** Nova Server Action `getUserBetsInPool` busca os palpites fechados de qualquer membro. `RankingTable` vira Client Component ("use client") e gerencia estado local (usuário selecionado, dados, loading, erro). O `Dialog` existente é reutilizado sem alteração.

**Tech Stack:** Next.js 15 App Router, Server Actions, React 19 (useState/useCallback), Prisma ORM, Tailwind CSS, componentes `Dialog` e `Flag` já existentes.

---

## File Map

| Arquivo | Mudança |
|---------|---------|
| `src/server/actions/bets.ts` | Adiciona `UserBetRow` interface e `getUserBetsInPool` action |
| `src/components/pool/ranking-table.tsx` | Rewrite completo: "use client", prop `poolId`, estado, Dialog |
| `src/app/(app)/b/[slug]/page.tsx` | Passa `poolId` para `<RankingTable>` |

---

### Task 1: Server Action `getUserBetsInPool`

**Files:**
- Modify: `src/server/actions/bets.ts`

- [ ] **Step 1: Abrir o arquivo atual para edição**

Leia `src/server/actions/bets.ts`. O arquivo já tem `"use server"`, imports de `db`, `requireUserId`, `requireMembership` e o tipo `ActionResult<T>`.

- [ ] **Step 2: Adicionar a interface `UserBetRow` e a action**

Adicione ao final do arquivo (após o fechamento da função `upsertChampionBet`):

```typescript
export interface UserBetRow {
  matchId: string;
  kickoffAt: Date;
  homeName: string;
  homeCode: string;
  awayName: string;
  awayCode: string;
  homeScore: number | null;
  awayScore: number | null;
  homeGuess: number;
  awayGuess: number;
  pointsEarned: number;
}

/**
 * Retorna os palpites fechados de qualquer membro do bolão.
 * Requer que o caller seja membro do mesmo bolão.
 */
export async function getUserBetsInPool(
  targetUserId: string,
  poolId: string,
): Promise<ActionResult<UserBetRow[]>> {
  const callerId = await requireUserId();
  await requireMembership(poolId, callerId);

  const bets = await db.bet.findMany({
    where: {
      userId: targetUserId,
      poolId,
      match: { status: "FINISHED" },
    },
    orderBy: { match: { kickoffAt: "desc" } },
    select: {
      homeGuess: true,
      awayGuess: true,
      pointsEarned: true,
      match: {
        select: {
          id: true,
          kickoffAt: true,
          homeScore: true,
          awayScore: true,
          homeTeam: { select: { name: true, countryCode: true } },
          awayTeam: { select: { name: true, countryCode: true } },
        },
      },
    },
  });

  return {
    ok: true,
    data: bets.map((b) => ({
      matchId: b.match.id,
      kickoffAt: b.match.kickoffAt,
      homeName: b.match.homeTeam.name,
      homeCode: b.match.homeTeam.countryCode,
      awayName: b.match.awayTeam.name,
      awayCode: b.match.awayTeam.countryCode,
      homeScore: b.match.homeScore,
      awayScore: b.match.awayScore,
      homeGuess: b.homeGuess,
      awayGuess: b.awayGuess,
      pointsEarned: b.pointsEarned,
    })),
  };
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
cd c:/Projetos/BolaoCopa2026
npx tsc --noEmit
```

Esperado: sem erros novos.

- [ ] **Step 4: Commit**

```bash
git add src/server/actions/bets.ts
git commit -m "feat: server action getUserBetsInPool — palpites fechados de um membro"
```

---

### Task 2: `RankingTable` como Client Component com modal

**Files:**
- Modify: `src/components/pool/ranking-table.tsx`

- [ ] **Step 1: Substituir o conteúdo completo do arquivo**

Substitua todo o conteúdo de `src/components/pool/ranking-table.tsx` por:

```tsx
"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Dialog } from "@/components/ui/dialog";
import { Flag } from "@/components/flag";
import { getUserBetsInPool, type UserBetRow } from "@/server/actions/bets";
import type { RankingRow } from "@/server/services/ranking";

const MEDAL_COLOR: Record<number, string> = {
  1: "bg-yellow-400/15 text-yellow-400 border-yellow-400/30",
  2: "bg-gray-400/15 text-gray-300 border-gray-300/30",
  3: "bg-amber-700/15 text-amber-600 border-amber-600/30",
};

const MEDAL_EMOJI: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

interface SelectedUser {
  userId: string;
  name: string;
  image: string | null;
}

export function RankingTable({
  rows,
  currentUserId,
  poolId,
}: {
  rows: RankingRow[];
  currentUserId: string;
  poolId: string;
}) {
  const [selectedUser, setSelectedUser] = useState<SelectedUser | null>(null);
  const [bets, setBets] = useState<UserBetRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRowClick = useCallback(
    async (user: SelectedUser) => {
      setSelectedUser(user);
      setBets(null);
      setError(null);
      setLoading(true);
      const result = await getUserBetsInPool(user.userId, poolId);
      setLoading(false);
      if (result.ok) {
        setBets(result.data);
      } else {
        setError(result.error);
      }
    },
    [poolId],
  );

  const handleClose = useCallback(() => {
    setSelectedUser(null);
    setBets(null);
    setError(null);
  }, []);

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem participantes ainda.</p>;
  }

  const totalPoints = bets?.reduce((sum, b) => sum + b.pointsEarned, 0) ?? 0;
  const hits = bets?.filter((b) => b.pointsEarned > 0).length ?? 0;
  const misses = bets?.filter((b) => b.pointsEarned === 0).length ?? 0;

  return (
    <>
      <div className="space-y-2">
        {rows.map((r) => {
          const isMe = r.userId === currentUserId;
          const hasMedal = r.position <= 3;

          return (
            <div
              key={r.userId}
              role="button"
              tabIndex={0}
              onClick={() =>
                handleRowClick({
                  userId: r.userId,
                  name: r.name ?? "Anônimo",
                  image: r.image,
                })
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleRowClick({
                    userId: r.userId,
                    name: r.name ?? "Anônimo",
                    image: r.image,
                  });
                }
              }}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-secondary/40",
                isMe
                  ? "border-primary/40 bg-primary/10"
                  : "border-border bg-card",
              )}
            >
              {/* Posição */}
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-bold",
                  hasMedal
                    ? MEDAL_COLOR[r.position]
                    : "border-border bg-secondary text-muted-foreground",
                )}
              >
                {hasMedal ? MEDAL_EMOJI[r.position] : r.position}
              </div>

              {/* Avatar */}
              {r.image ? (
                <Image
                  src={r.image}
                  alt={r.name ?? ""}
                  width={36}
                  height={36}
                  className="h-9 w-9 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-sm font-semibold">
                  {(r.name ?? "?").charAt(0).toUpperCase()}
                </div>
              )}

              {/* Nome */}
              <div className="min-w-0 flex-1">
                <p className={cn("truncate font-semibold", isMe && "text-primary")}>
                  {r.name ?? "Anônimo"}
                  {isMe && <span className="ml-1 text-xs font-normal">(você)</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {r.hits} acerto{r.hits !== 1 ? "s" : ""} · {r.misses} erro
                  {r.misses !== 1 ? "s" : ""}
                </p>
              </div>

              {/* Pontuação */}
              <div className="text-right">
                <p
                  className={cn(
                    "text-lg font-bold tabular-nums",
                    hasMedal && "text-accent",
                  )}
                >
                  {r.totalPoints}
                </p>
                <p className="text-xs text-muted-foreground">pts</p>
              </div>
            </div>
          );
        })}
      </div>

      {selectedUser && (
        <Dialog
          open={!!selectedUser}
          onClose={handleClose}
          title={
            <div className="flex items-center gap-2">
              {selectedUser.image ? (
                <Image
                  src={selectedUser.image}
                  alt={selectedUser.name}
                  width={24}
                  height={24}
                  className="h-6 w-6 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                  {selectedUser.name.charAt(0).toUpperCase()}
                </div>
              )}
              <span>{selectedUser.name}</span>
            </div>
          }
          description="Jogos fechados com palpite"
        >
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}

          {error && (
            <p className="text-center text-sm text-destructive">{error}</p>
          )}

          {!loading && !error && bets?.length === 0 && (
            <p className="text-center text-sm text-muted-foreground">
              Nenhum jogo finalizado com palpite ainda.
            </p>
          )}

          {!loading && !error && bets && bets.length > 0 && (
            <>
              <div className="space-y-2">
                {bets.map((b) => (
                  <div
                    key={b.matchId}
                    className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm"
                  >
                    {/* Time da casa */}
                    <div className="flex min-w-0 flex-1 items-center gap-1.5">
                      <Flag countryCode={b.homeCode} name={b.homeName} size={16} />
                      <span className="truncate">{b.homeName}</span>
                    </div>

                    {/* Placar */}
                    <div className="shrink-0 text-center">
                      <p className="font-mono font-bold tabular-nums">
                        {b.homeGuess} × {b.awayGuess}
                      </p>
                      {b.homeScore !== null && b.awayScore !== null && (
                        <p className="text-xs text-muted-foreground">
                          {b.homeScore} × {b.awayScore}
                        </p>
                      )}
                    </div>

                    {/* Time visitante */}
                    <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
                      <span className="truncate text-right">{b.awayName}</span>
                      <Flag countryCode={b.awayCode} name={b.awayName} size={16} />
                    </div>

                    {/* Pontos */}
                    <div className="ml-1 shrink-0 w-10 text-right">
                      <span
                        className={cn(
                          "text-xs font-semibold",
                          b.pointsEarned > 0 ? "text-green-400" : "text-muted-foreground",
                        )}
                      >
                        {b.pointsEarned} pts
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Rodapé com totais */}
              <div className="flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                <span>
                  {hits} acerto{hits !== 1 ? "s" : ""} · {misses} erro
                  {misses !== 1 ? "s" : ""}
                </span>
                <span className="font-bold text-foreground">{totalPoints} pts</span>
              </div>
            </>
          )}
        </Dialog>
      )}
    </>
  );
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/pool/ranking-table.tsx
git commit -m "feat: ranking rows clicáveis com modal de extrato do participante"
```

---

### Task 3: Passar `poolId` para `RankingTable` na página do bolão

**Files:**
- Modify: `src/app/(app)/b/[slug]/page.tsx` (linha ~108)

- [ ] **Step 1: Atualizar `RankingSection`**

Localize a função `RankingSection` (em torno da linha 103). Ela atualmente recebe `{ poolId, userId }` e chama `<RankingTable rows={rows} currentUserId={userId} />`. Adicione o prop `poolId`:

```tsx
async function RankingSection({ poolId, userId }: { poolId: string; userId: string }) {
  const [rows, race] = await Promise.all([getRanking(poolId), getRaceData(poolId)]);
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.15fr] lg:items-start">
      <RankingTable rows={rows} currentUserId={userId} poolId={poolId} />
      <RaceTrack data={race} currentUserId={userId} />
    </div>
  );
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/(app)/b/[slug]/page.tsx
git commit -m "feat: passa poolId para RankingTable"
```

---

### Task 4: Verificação manual no browser

- [ ] **Step 1: Iniciar o servidor de desenvolvimento**

```bash
npm run dev
```

- [ ] **Step 2: Testar fluxo completo**

1. Acesse `/b/<slug>` (aba Ranking).
2. Clique em qualquer linha — o modal deve abrir com spinner e depois listar os jogos fechados.
3. Verifique que o palpite (`homeGuess × awayGuess`), o resultado real e os pontos aparecem.
4. Linhas com pontos > 0 devem aparecer em verde; linhas sem ponto em cinza.
5. O rodapé deve totalizar pontos e contagem de acertos/erros.
6. Participante sem palpites fechados deve exibir "Nenhum jogo finalizado com palpite ainda."
7. Fechar com X, clique no backdrop e Esc — todos devem fechar o modal.
8. Clicar em outro participante enquanto modal está aberto deve substituir o conteúdo.

- [ ] **Step 3: Checar console do browser**

Sem erros de hidratação ou warnings de chave React.
