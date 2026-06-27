# Mata-mata: escolha de quem avança nos pênaltis + correção do salvamento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Liberar o salvamento de palpites de mata-mata assim que o confronto é definido na API e, quando o usuário palpita empate num jogo eliminatório, exigir e pontuar a escolha de quem avança nos pênaltis.

**Architecture:** Lógica de regra de palpite e de pontuação extraída em funções **puras** (testáveis sem banco). O pick do usuário (`Bet.advances`) e o vencedor real do shootout (`Match.penaltyWinner`) são novos campos de um enum `Advance`. O vencedor real chega pelo provider (Football-Data `score.winner`/`score.duration`) ou pelo lançamento manual do admin. O bônus é uma constante fixa (1 ponto), somada à pontuação base de empate.

**Tech Stack:** Next.js 15 (App Router, server actions), Prisma + PostgreSQL, Zod, Vitest, React 19, Tailwind.

## Global Constraints

- Bônus de acerto de quem avança nos pênaltis = **1 ponto**, constante fixa (não configurável por bolão). Valor em `POINTS_PENALTY_ADVANCE`.
- Enum novo chama-se `Advance` com valores `HOME` e `AWAY`.
- A escolha de quem avança é **obrigatória** para salvar um palpite de empate de mata-mata (`stage !== "GROUP"`).
- O seletor aparece **somente no card do jogo** (`match-card.tsx`).
- Grupos não têm seletor (empate é resultado válido).
- O bônus só é concedido quando o jogo real foi decidido nos pênaltis (`Match.penaltyWinner != null`).
- Migrações Prisma são versionadas (`prisma migrate`); `migrate deploy` roda no build. Toda alteração de schema precisa de uma migração nova.
- Funções de regra/pontuação devem permanecer **puras** (sem `db`) para teste com Vitest, seguindo o padrão de `scoring.ts`/`manual-result.ts`.
- Textos de UI/erro em PT-BR.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `src/lib/bet-gate.ts` (novo) | Regras puras de palpite: jogo fechado (`isBetClosed`) e empate de mata-mata exige pick (`isKnockoutDraw`). |
| `src/lib/bet-gate.test.ts` (novo) | Testes das regras puras. |
| `prisma/schema.prisma` + migração nova | enum `Advance`, `Bet.advances`, `Match.penaltyWinner`. |
| `src/lib/constants.ts` | `POINTS_PENALTY_ADVANCE = 1`. |
| `src/lib/validations.ts` | `advances` opcional em `betSchema`. |
| `src/server/actions/bets.ts` | Remove gate global; valida/persiste `advances`. |
| `src/server/services/scoring.ts` | Bônus de pênaltis em `computeBetPoints` + `scoreFinishedMatches`. |
| `src/lib/football-score.ts` (novo) | `mapPenaltyWinner` puro (winner/duration → `Advance`). |
| `src/lib/football-score.test.ts` (novo) | Testes do mapeamento. |
| `src/server/providers/football/{types,football-data}.ts` | `penaltyWinner` no `ProviderMatch` e no fetch. |
| `src/server/services/sync.ts` | Persiste `penaltyWinner`. |
| `src/lib/manual-result.ts` | `penaltyWinner` opcional no schema manual. |
| `src/server/services/manual-result.ts` | Persiste `penaltyWinner` no lançamento manual. |
| `src/server/services/matches.ts` | Seleciona/expõe `advances` e `penaltyWinner`; estende tipos. |
| `src/components/match/match-card.tsx` | Seletor de avanço + exibição. |

---

## Task 1: Correção do salvamento — remover gate global de mata-mata

**Files:**
- Create: `src/lib/bet-gate.ts`
- Create: `src/lib/bet-gate.test.ts`
- Modify: `src/server/actions/bets.ts`

**Interfaces:**
- Produces: `isBetClosed(match: { lockAt: Date; status: MatchStatus }, now?: Date): boolean`

- [ ] **Step 1: Write the failing test**

Create `src/lib/bet-gate.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isBetClosed } from "./bet-gate";

const NOW = new Date("2026-06-27T18:00:00.000Z");

describe("isBetClosed", () => {
  it("aberto: SCHEDULED e lockAt no futuro", () => {
    expect(
      isBetClosed({ lockAt: new Date("2026-06-27T19:00:00.000Z"), status: "SCHEDULED" }, NOW),
    ).toBe(false);
  });

  it("fechado: lockAt já passou", () => {
    expect(
      isBetClosed({ lockAt: new Date("2026-06-27T17:00:00.000Z"), status: "SCHEDULED" }, NOW),
    ).toBe(true);
  });

  it("fechado: status diferente de SCHEDULED", () => {
    expect(
      isBetClosed({ lockAt: new Date("2026-06-27T19:00:00.000Z"), status: "LIVE" }, NOW),
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/bet-gate.test.ts`
Expected: FAIL — `Failed to resolve import "./bet-gate"` / `isBetClosed is not a function`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/bet-gate.ts`:

```ts
import type { MatchStatus } from "@prisma/client";

/**
 * Jogo fechado para palpite: travado pelo horário (lockAt) ou já não-agendado.
 * Esta é a ÚNICA autoridade de liberação por jogo — vale para grupos e
 * mata-mata. Como o sync só cria Match com os dois times resolvidos, todo jogo
 * de mata-mata no banco já tem confronto definido e pode ser palpitado até o
 * lockAt. Confrontos indefinidos existem apenas como partidas virtuais
 * (não persistidas), que nem chegam ao upsertBet.
 */
export function isBetClosed(
  match: { lockAt: Date; status: MatchStatus },
  now: Date = new Date(),
): boolean {
  return now >= match.lockAt || match.status !== "SCHEDULED";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/bet-gate.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Refactor `upsertBet` para remover o gate global**

Em `src/server/actions/bets.ts`:

Remover o import não mais usado e o gate global, e usar `isBetClosed`.

Trocar:

```ts
import { isGroupStageComplete } from "@/server/services/matches";
```

por:

```ts
import { isBetClosed } from "@/lib/bet-gate";
```

Remover este bloco inteiro:

```ts
  // Fases finais só abrem após o término da fase de grupos.
  if (match.stage !== "GROUP" && !(await isGroupStageComplete())) {
    return { ok: false, error: "Os palpites das fases finais abrem após a fase de grupos" };
  }

```

Trocar a checagem por jogo:

```ts
  if (new Date() >= match.lockAt || match.status !== "SCHEDULED") {
    return { ok: false, error: "Palpites encerrados para este jogo" };
  }
```

por:

```ts
  if (isBetClosed(match)) {
    return { ok: false, error: "Palpites encerrados para este jogo" };
  }
```

> Observação: o `select` do `match` ainda pode incluir `stage` (será usado na Task 4). Não remova `stage` do `select`.

- [ ] **Step 6: Verificar tipos e suíte completa**

Run: `npm run typecheck && npm test`
Expected: typecheck sem erros; todos os testes passam. (Confirma que nenhum outro arquivo importava o que mudou.)

- [ ] **Step 7: Commit**

```bash
git add src/lib/bet-gate.ts src/lib/bet-gate.test.ts src/server/actions/bets.ts
git commit -m "fix: libera palpite de mata-mata assim que o confronto e definido

Remove o gate global isGroupStageComplete do upsertBet; passa a confiar na
checagem por jogo (isBetClosed: lockAt/status). Confrontos indefinidos seguem
apenas como partidas virtuais nao palpitaveis.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Schema — enum `Advance`, `Bet.advances`, `Match.penaltyWinner`

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_advance_penalty_pick/migration.sql`

**Interfaces:**
- Produces: tipo Prisma `Advance` (`"HOME" | "AWAY"`); campos `Bet.advances: Advance | null`, `Match.penaltyWinner: Advance | null`.

- [ ] **Step 1: Adicionar o enum `Advance` ao schema**

Em `prisma/schema.prisma`, logo após o bloco `enum MatchStatus { ... }`, adicionar:

```prisma
// Quem avança num confronto de mata-mata (palpite do usuário e resultado real).
enum Advance {
  HOME
  AWAY
}
```

- [ ] **Step 2: Adicionar `penaltyWinner` ao model `Match`**

Em `model Match`, após a linha `resultConfirmed Boolean  @default(false)`, adicionar:

```prisma
  // Vencedor real do shootout — preenchido só quando o jogo de mata-mata foi
  // decidido nos pênaltis. homeScore/awayScore guardam o placar EMPATADO do
  // tempo normal/prorrogação; os pênaltis ficam só aqui.
  penaltyWinner Advance?
```

- [ ] **Step 3: Adicionar `advances` ao model `Bet`**

Em `model Bet`, após a linha `awayGuess    Int`, adicionar:

```prisma
  // Pick do usuário de quem avança nos pênaltis — preenchido só em palpite de
  // empate no mata-mata; null nos demais casos.
  advances     Advance?
```

- [ ] **Step 4: Criar a migração**

Run: `npx prisma migrate dev --name add_advance_penalty_pick`
Expected: cria a pasta de migração, aplica no banco de dev e regenera o client.

> **Se não houver banco de dev acessível:** criar manualmente a pasta
> `prisma/migrations/20260627120000_add_advance_penalty_pick/` com
> `migration.sql` abaixo, e depois `npx prisma generate`.

```sql
-- CreateEnum
CREATE TYPE "Advance" AS ENUM ('HOME', 'AWAY');

-- AlterTable
ALTER TABLE "Match" ADD COLUMN "penaltyWinner" "Advance";

-- AlterTable
ALTER TABLE "Bet" ADD COLUMN "advances" "Advance";
```

- [ ] **Step 5: Validar e gerar o client**

Run: `npx prisma validate && npx prisma generate`
Expected: "The schema is valid" e client gerado sem erro.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): enum Advance + Bet.advances + Match.penaltyWinner

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Constante de bônus + validação do payload

**Files:**
- Modify: `src/lib/constants.ts`
- Modify: `src/lib/validations.ts`
- Modify: `src/lib/bet-gate.ts`
- Modify: `src/lib/bet-gate.test.ts`

**Interfaces:**
- Consumes: tipo `Advance` (Task 2)
- Produces:
  - `POINTS_PENALTY_ADVANCE: number` (= 1) em `src/lib/constants.ts`
  - `betSchema` com `advances?: "HOME" | "AWAY"`
  - `isKnockoutDraw(stage: MatchStage, homeGuess: number, awayGuess: number): boolean` em `src/lib/bet-gate.ts`

- [ ] **Step 1: Adicionar a constante**

Em `src/lib/constants.ts`, ao final do arquivo, adicionar:

```ts
/** Bônus por acertar quem avança nos pênaltis num jogo de mata-mata decidido
 *  no shootout. Fixo (não configurável por bolão). */
export const POINTS_PENALTY_ADVANCE = 1;
```

- [ ] **Step 2: Adicionar `advances` ao `betSchema`**

Em `src/lib/validations.ts`, no objeto `betSchema`, adicionar o campo:

```ts
export const betSchema = z.object({
  poolId: z.string().min(1),
  matchId: z.string().min(1),
  homeGuess: z.number().int().min(0).max(99),
  awayGuess: z.number().int().min(0).max(99),
  advances: z.enum(["HOME", "AWAY"]).optional(),
});
```

- [ ] **Step 3: Escrever o teste falho de `isKnockoutDraw`**

Em `src/lib/bet-gate.test.ts`, adicionar ao final:

```ts
import { isKnockoutDraw } from "./bet-gate";

describe("isKnockoutDraw", () => {
  it("mata-mata com placar empatado → true", () => {
    expect(isKnockoutDraw("R32", 1, 1)).toBe(true);
  });

  it("mata-mata com placar não-empatado → false", () => {
    expect(isKnockoutDraw("R32", 2, 1)).toBe(false);
  });

  it("grupo com placar empatado → false (empate é válido)", () => {
    expect(isKnockoutDraw("GROUP", 1, 1)).toBe(false);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run src/lib/bet-gate.test.ts`
Expected: FAIL — `isKnockoutDraw is not a function`.

- [ ] **Step 5: Implementar `isKnockoutDraw`**

Em `src/lib/bet-gate.ts`, adicionar o import do tipo e a função:

```ts
import type { MatchStage, MatchStatus } from "@prisma/client";
```

(substituindo o import existente `import type { MatchStatus } from "@prisma/client";`)

E ao final do arquivo:

```ts
/**
 * True quando o palpite é um empate num jogo de mata-mata — caso em que o
 * usuário precisa escolher quem avança nos pênaltis. Em grupos, empate é
 * resultado final válido e não exige escolha.
 */
export function isKnockoutDraw(
  stage: MatchStage,
  homeGuess: number,
  awayGuess: number,
): boolean {
  return stage !== "GROUP" && homeGuess === awayGuess;
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/lib/bet-gate.test.ts`
Expected: PASS (todos os blocos).

- [ ] **Step 7: Commit**

```bash
git add src/lib/constants.ts src/lib/validations.ts src/lib/bet-gate.ts src/lib/bet-gate.test.ts
git commit -m "feat: POINTS_PENALTY_ADVANCE, advances no betSchema e isKnockoutDraw

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: `upsertBet` — validar e persistir `advances`

**Files:**
- Modify: `src/server/actions/bets.ts`

**Interfaces:**
- Consumes: `isBetClosed`, `isKnockoutDraw` (`src/lib/bet-gate.ts`); `betSchema` com `advances` (Task 3)

- [ ] **Step 1: Importar `isKnockoutDraw`**

Em `src/server/actions/bets.ts`, ajustar o import do bet-gate:

```ts
import { isBetClosed, isKnockoutDraw } from "@/lib/bet-gate";
```

- [ ] **Step 2: Ler `advances` do payload e validar a obrigatoriedade**

No corpo de `upsertBet`, na desestruturação:

```ts
  const { poolId, matchId, homeGuess, awayGuess, advances } = parsed.data;
```

Depois da checagem `isBetClosed(match)`, adicionar:

```ts
  const knockoutDraw = isKnockoutDraw(match.stage, homeGuess, awayGuess);
  if (knockoutDraw && !advances) {
    return { ok: false, error: "Escolha quem avança nos pênaltis" };
  }
  // Só persiste o pick em empate de mata-mata; nos demais casos, limpa.
  const advancesToStore = knockoutDraw ? advances! : null;
```

- [ ] **Step 3: Persistir `advances` no upsert**

Trocar o `db.bet.upsert(...)` por:

```ts
  await db.bet.upsert({
    where: { userId_poolId_matchId: { userId, poolId, matchId } },
    update: { homeGuess, awayGuess, advances: advancesToStore },
    create: { userId, poolId, matchId, homeGuess, awayGuess, advances: advancesToStore },
  });
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: sem erros (confirma que `match.stage` está no `select` e que os tipos batem).

- [ ] **Step 5: Commit**

```bash
git add src/server/actions/bets.ts
git commit -m "feat: upsertBet exige e persiste o pick de penaltis no empate de mata-mata

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Pontuação — bônus por acertar quem avança

**Files:**
- Modify: `src/server/services/scoring.ts`
- Modify: `src/server/services/scoring.test.ts`

**Interfaces:**
- Consumes: tipo `Advance` (Task 2); `POINTS_PENALTY_ADVANCE` (Task 3)
- Produces: `computeBetPoints(rule, guess, actual, penalty?)` com 4º parâmetro opcional `{ betAdvances?: Advance | null; penaltyWinner?: Advance | null; bonus?: number }`

- [ ] **Step 1: Escrever os testes falhos do bônus**

Em `src/server/services/scoring.test.ts`, adicionar ao final:

```ts
describe("computeBetPoints — bônus de pênaltis (mata-mata)", () => {
  // Jogo real foi aos pênaltis: actual é empate (1x1) e penaltyWinner definido.
  it("empate certo + acertou quem passou → base empate (2) + bônus (1) = 3", () => {
    expect(
      computeBetPoints(rule, { home: 1, away: 1 }, { home: 1, away: 1 }, {
        betAdvances: "HOME",
        penaltyWinner: "HOME",
        bonus: 1,
      }),
    ).toBe(3);
  });

  it("empate certo + errou quem passou → só base empate (2)", () => {
    expect(
      computeBetPoints(rule, { home: 1, away: 1 }, { home: 1, away: 1 }, {
        betAdvances: "AWAY",
        penaltyWinner: "HOME",
        bonus: 1,
      }),
    ).toBe(2);
  });

  it("jogo não foi aos pênaltis (penaltyWinner null) → sem bônus", () => {
    expect(
      computeBetPoints(rule, { home: 1, away: 1 }, { home: 1, away: 1 }, {
        betAdvances: "HOME",
        penaltyWinner: null,
        bonus: 1,
      }),
    ).toBe(2);
  });

  it("palpite não foi empate → sem bônus mesmo com penaltyWinner", () => {
    // previu 2x1 (vitória mandante) num jogo que terminou 1x1 nos pênaltis:
    // erra a base (0) e não recebe bônus.
    expect(
      computeBetPoints(rule, { home: 2, away: 1 }, { home: 1, away: 1 }, {
        betAdvances: "HOME",
        penaltyWinner: "HOME",
        bonus: 1,
      }),
    ).toBe(0);
  });

  it("sem o 4º parâmetro, comportamento antigo é preservado", () => {
    expect(computeBetPoints(rule, { home: 1, away: 1 }, { home: 1, away: 1 })).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/services/scoring.test.ts`
Expected: FAIL nos novos casos (o 4º parâmetro ainda é ignorado; o caso "3" retorna 2).

- [ ] **Step 3: Estender `computeBetPoints`**

Em `src/server/services/scoring.ts`, ajustar o import e a função:

```ts
import type { Advance, ScoringRule } from "@prisma/client";
```

(substituindo `import type { ScoringRule } from "@prisma/client";`)

Trocar a assinatura/corpo de `computeBetPoints` por:

```ts
export function computeBetPoints(
  rule: Pick<
    ScoringRule,
    "pointsExactScore" | "pointsCorrectResult" | "pointsCorrectDraw"
  >,
  guess: { home: number; away: number },
  actual: { home: number; away: number },
  penalty?: {
    betAdvances?: Advance | null;
    penaltyWinner?: Advance | null;
    bonus?: number;
  },
): number {
  const exact = guess.home === actual.home && guess.away === actual.away;
  const sameOutcome = outcome(guess.home, guess.away) === outcome(actual.home, actual.away);

  if (!sameOutcome) return 0;

  const isDraw = actual.home === actual.away;
  const base = isDraw ? rule.pointsCorrectDraw : rule.pointsCorrectResult;
  let points = exact ? base + rule.pointsExactScore : base;

  // Bônus de mata-mata: jogo decidido nos pênaltis (penaltyWinner != null),
  // palpite foi empate e o usuário acertou quem avançou.
  if (
    penalty?.penaltyWinner != null &&
    guess.home === guess.away &&
    penalty.betAdvances != null &&
    penalty.betAdvances === penalty.penaltyWinner
  ) {
    points += penalty.bonus ?? 0;
  }

  return points;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/services/scoring.test.ts`
Expected: PASS (incluindo `scoring.comprehensive.test.ts` se rodado junto — comportamento antigo preservado).

- [ ] **Step 5: Passar o bônus no `scoreFinishedMatches`**

Ainda em `src/server/services/scoring.ts`:

Adicionar o import da constante no topo:

```ts
import { POINTS_PENALTY_ADVANCE } from "@/lib/constants";
```

No `findMany` dos matches, incluir `penaltyWinner` no `select`:

```ts
    select: { id: true, homeScore: true, awayScore: true, penaltyWinner: true },
```

Na chamada de `computeBetPoints` dentro do loop de bets, passar o 4º argumento:

```ts
        const points = computeBetPoints(
          rule,
          { home: bet.homeGuess, away: bet.awayGuess },
          actual,
          {
            betAdvances: bet.advances,
            penaltyWinner: match.penaltyWinner,
            bonus: POINTS_PENALTY_ADVANCE,
          },
        );
```

> `bet.advances` já vem no objeto (o `findMany` de bets usa `include`, que traz todos os campos escalares do `Bet`).

- [ ] **Step 6: Typecheck + suíte**

Run: `npm run typecheck && npm test`
Expected: sem erros; todos os testes passam.

- [ ] **Step 7: Commit**

```bash
git add src/server/services/scoring.ts src/server/services/scoring.test.ts
git commit -m "feat(scoring): bonus de 1 ponto por acertar quem avanca nos penaltis

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Provider — capturar o vencedor real do shootout

**Files:**
- Create: `src/lib/football-score.ts`
- Create: `src/lib/football-score.test.ts`
- Modify: `src/server/providers/football/types.ts`
- Modify: `src/server/providers/football/football-data.ts`
- Modify: `src/server/services/sync.ts`

**Interfaces:**
- Consumes: tipo `Advance` (Task 2)
- Produces:
  - `mapPenaltyWinner(score: { winner?: string | null; duration?: string | null }): Advance | null` em `src/lib/football-score.ts`
  - `ProviderMatch.penaltyWinner: Advance | null`

- [ ] **Step 1: Escrever o teste falho do mapeamento**

Create `src/lib/football-score.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mapPenaltyWinner } from "./football-score";

describe("mapPenaltyWinner", () => {
  it("shootout com mandante vencedor → HOME", () => {
    expect(mapPenaltyWinner({ winner: "HOME_TEAM", duration: "PENALTY_SHOOTOUT" })).toBe("HOME");
  });

  it("shootout com visitante vencedor → AWAY", () => {
    expect(mapPenaltyWinner({ winner: "AWAY_TEAM", duration: "PENALTY_SHOOTOUT" })).toBe("AWAY");
  });

  it("jogo decidido no tempo normal → null", () => {
    expect(mapPenaltyWinner({ winner: "HOME_TEAM", duration: "REGULAR" })).toBe(null);
  });

  it("prorrogação sem pênaltis → null", () => {
    expect(mapPenaltyWinner({ winner: "AWAY_TEAM", duration: "EXTRA_TIME" })).toBe(null);
  });

  it("campos ausentes → null", () => {
    expect(mapPenaltyWinner({})).toBe(null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/football-score.test.ts`
Expected: FAIL — `Failed to resolve import "./football-score"`.

- [ ] **Step 3: Implementar `mapPenaltyWinner`**

Create `src/lib/football-score.ts`:

```ts
import type { Advance } from "@prisma/client";

/**
 * Deriva o vencedor do shootout a partir do bloco `score` da Football-Data.
 * Só retorna HOME/AWAY quando o jogo foi `PENALTY_SHOOTOUT`; nos demais casos
 * (tempo normal, prorrogação) retorna null — o resultado fica em fullTime.
 */
export function mapPenaltyWinner(score: {
  winner?: string | null;
  duration?: string | null;
}): Advance | null {
  if (score.duration !== "PENALTY_SHOOTOUT") return null;
  if (score.winner === "HOME_TEAM") return "HOME";
  if (score.winner === "AWAY_TEAM") return "AWAY";
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/football-score.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: Adicionar `penaltyWinner` ao `ProviderMatch`**

Em `src/server/providers/football/types.ts`, no `import` e na interface `ProviderMatch`:

```ts
import type { Advance, MatchStage, MatchStatus } from "@prisma/client";
```

E adicionar o campo após `status: MatchStatus;`:

```ts
  penaltyWinner: Advance | null;
```

- [ ] **Step 6: Ler winner/duration no `football-data.ts`**

Em `src/server/providers/football/football-data.ts`:

Importar o helper no topo:

```ts
import { mapPenaltyWinner } from "@/lib/football-score";
```

Estender a interface `FDMatch` — trocar a linha do `score` por:

```ts
  score: {
    winner?: string | null;
    duration?: string | null;
    fullTime: { home: number | null; away: number | null };
  };
```

No `.map(...)` de `fetchMatches`, adicionar o campo ao objeto retornado (após `status: mapStatus(m.status),`):

```ts
        penaltyWinner: mapPenaltyWinner(m.score),
```

- [ ] **Step 7: Persistir `penaltyWinner` no `sync.ts`**

Em `src/server/services/sync.ts`, dentro do objeto `result` (escrito quando `!decision.locked`), adicionar a linha `penaltyWinner`:

```ts
    const result = decision.locked
      ? null
      : {
          homeScore: decision.homeScore,
          awayScore: decision.awayScore,
          status: decision.status,
          resultConfirmed: decision.resultConfirmed,
          penaltyWinner: m.penaltyWinner,
          ...(decision.scored !== undefined ? { scored: decision.scored } : {}),
        };
```

- [ ] **Step 8: Typecheck + suíte**

Run: `npm run typecheck && npm test`
Expected: sem erros; testes passam.

- [ ] **Step 9: Commit**

```bash
git add src/lib/football-score.ts src/lib/football-score.test.ts src/server/providers/football/types.ts src/server/providers/football/football-data.ts src/server/services/sync.ts
git commit -m "feat(sync): captura penaltyWinner do provider (score.winner/duration)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

> **Verificação pós-deploy (anotada no spec):** confirmar contra dado real da
> Football-Data v4 se, em jogos de shootout, `score.fullTime` traz o placar
> EMPATADO do tempo normal/prorrogação (esperado) ou já inclui os pênaltis. Se
> incluir, será necessário ajustar a leitura do placar — fora do escopo desta
> task, mas registrar o achado.

---

## Task 7: Lançamento manual — aceitar `penaltyWinner`

**Files:**
- Modify: `src/lib/manual-result.ts`
- Modify: `src/lib/manual-result.test.ts`
- Modify: `src/server/services/manual-result.ts`

**Interfaces:**
- Produces: `manualResultSchema` com `penaltyWinner?: "HOME" | "AWAY"`

- [ ] **Step 1: Escrever o teste falho**

Em `src/lib/manual-result.test.ts`, adicionar dentro do `describe("manualResultSchema", ...)`:

```ts
  it("aceita penaltyWinner opcional", () => {
    const r = manualResultSchema.safeParse({
      externalId: "1",
      homeScore: 1,
      awayScore: 1,
      penaltyWinner: "HOME",
    });
    expect(r.success).toBe(true);
  });

  it("rejeita penaltyWinner inválido", () => {
    const r = manualResultSchema.safeParse({
      externalId: "1",
      homeScore: 1,
      awayScore: 1,
      penaltyWinner: "DRAW",
    });
    expect(r.success).toBe(false);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/manual-result.test.ts`
Expected: FAIL no caso "rejeita penaltyWinner inválido" (campo desconhecido é ignorado pelo zod por padrão, então "DRAW" passaria).

- [ ] **Step 3: Adicionar `penaltyWinner` ao schema**

Em `src/lib/manual-result.ts`, no objeto de `manualResultSchema`, adicionar antes do `.refine(...)`:

```ts
    penaltyWinner: z.enum(["HOME", "AWAY"]).optional(),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/manual-result.test.ts`
Expected: PASS.

- [ ] **Step 5: Persistir no `applyManualResults`**

Em `src/server/services/manual-result.ts`, no `db.match.update(...)`, adicionar `penaltyWinner` ao `data`:

```ts
      data: {
        homeScore: r.homeScore,
        awayScore: r.awayScore,
        status: "FINISHED",
        scored: false,
        resultConfirmed: true,
        penaltyWinner: r.penaltyWinner ?? null,
      },
```

- [ ] **Step 6: Typecheck + suíte**

Run: `npm run typecheck && npm test`
Expected: sem erros; testes passam.

- [ ] **Step 7: Commit**

```bash
git add src/lib/manual-result.ts src/lib/manual-result.test.ts src/server/services/manual-result.ts
git commit -m "feat(admin): set-result aceita penaltyWinner para shootouts

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Propagar `advances` e `penaltyWinner` até a UI

**Files:**
- Modify: `src/server/services/matches.ts`

**Interfaces:**
- Produces:
  - `MatchWithBet.penaltyWinner: Advance | null`
  - `MatchWithBet.bet: { homeGuess: number; awayGuess: number; pointsEarned: number; advances: Advance | null } | null`

- [ ] **Step 1: Importar o tipo `Advance`**

Em `src/server/services/matches.ts`, ajustar o import de tipos do Prisma:

```ts
import type { Advance, MatchStage, MatchStatus } from "@prisma/client";
```

- [ ] **Step 2: Estender a interface `MatchWithBet`**

Trocar o campo `bet` e adicionar `penaltyWinner` na interface:

```ts
  homeScore: number | null;
  awayScore: number | null;
  penaltyWinner: Advance | null;
  home: { name: string; countryCode: string; crestUrl: string | null };
  away: { name: string; countryCode: string; crestUrl: string | null };
  bet: { homeGuess: number; awayGuess: number; pointsEarned: number; advances: Advance | null } | null;
```

- [ ] **Step 3: Selecionar e mapear os campos nos quatro getters**

Em `getMatchesWithBets`, `getAllMatchesWithBets` e `getUpcomingMatchesWithBets`:

No `bets: { ... select: { ... } }`, adicionar `advances: true`:

```ts
        select: { homeGuess: true, awayGuess: true, pointsEarned: true, advances: true },
```

No `.map((m) => ({ ... }))` de cada um, adicionar `penaltyWinner: m.penaltyWinner,` junto aos demais campos (ex.: após `awayScore: m.awayScore,`):

```ts
      penaltyWinner: m.penaltyWinner,
```

> `m.bets[0] ?? null` já carrega `advances` automaticamente (está no `select`).
> O `include` traz os campos selecionados; o objeto `bet` agora satisfaz o tipo.

- [ ] **Step 4: Definir `penaltyWinner` nas partidas virtuais**

Em `getKnockoutMatchesWithVirtual`, no objeto `virtual.push({ ... })`, adicionar após `awayScore: null,`:

```ts
        penaltyWinner: null,
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: sem erros (todos os objetos `MatchWithBet` agora têm `penaltyWinner`; `getAllMatchesWithBets` usa `satisfies MatchWithBet[]`, que valida).

- [ ] **Step 6: Commit**

```bash
git add src/server/services/matches.ts
git commit -m "feat: expoe advances e penaltyWinner em MatchWithBet

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: UI — seletor de quem avança no card do jogo

**Files:**
- Modify: `src/components/match/match-card.tsx`

**Interfaces:**
- Consumes: `MatchWithBet` com `bet.advances` e `penaltyWinner` (Task 8); `upsertBet` aceitando `advances` (Task 4)

- [ ] **Step 1: Estado e tipo do pick**

No topo de `match-card.tsx`, adicionar o import de tipo:

```ts
import type { Advance } from "@prisma/client";
```

Dentro de `MatchCard`, após os estados `home`/`away`, adicionar:

```ts
  const [advances, setAdvances] = useState<Advance | "">(match.bet?.advances ?? "");
  const isKnockout = match.stage !== "GROUP";
```

- [ ] **Step 2: Reescrever `save` para considerar o pick obrigatório**

Trocar a função `save` por uma versão que recebe também o pick e valida o empate de mata-mata:

```ts
  const save = useCallback(
    (h: string, a: string, adv: Advance | "") => {
      if (h === "" || a === "") return;
      const knockoutDraw = isKnockout && h === a;
      // Empate de mata-mata sem escolha de quem avança: não salva ainda.
      if (knockoutDraw && adv === "") {
        setSaveState("idle");
        return;
      }
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setSaveState("saving");
        startTransition(async () => {
          const res = await upsertBet({
            poolId,
            matchId: match.id,
            homeGuess: Number(h),
            awayGuess: Number(a),
            advances: knockoutDraw ? adv : undefined,
          });
          setSaveState(res.ok ? "saved" : "error");
          if (res.ok) setTimeout(() => setSaveState("idle"), 2000);
        });
      }, 600);
    },
    [match.id, poolId, isKnockout],
  );
```

- [ ] **Step 3: Handlers de placar que limpam o pick fora de empate**

Trocar os `onChange` dos dois `ScoreInput` por handlers que recalculam o pick:

```ts
              <ScoreInput
                value={home}
                disabled={locked}
                onChange={(v) => {
                  setHome(v);
                  const nextAdv = isKnockout && v !== "" && v === away ? advances : "";
                  setAdvances(nextAdv);
                  save(v, away, nextAdv);
                }}
              />
              <span className="text-lg font-light text-muted-foreground">×</span>
              <ScoreInput
                value={away}
                disabled={locked}
                onChange={(v) => {
                  setAway(v);
                  const nextAdv = isKnockout && v !== "" && v === home ? advances : "";
                  setAdvances(nextAdv);
                  save(home, v, nextAdv);
                }}
              />
```

- [ ] **Step 4: Renderizar o seletor de avanço (empate de mata-mata, não travado)**

Logo após o bloco dos inputs de palpite (o `<div className="flex items-center gap-1.5">...</div>` dos `ScoreInput`), ainda dentro do ramo `!isFinished && !isLive`, adicionar o seletor. Substituir o trecho:

```tsx
          ) : (
            /* Inputs de palpite */
            <div className="flex items-center gap-1.5">
              {/* ...ScoreInputs... */}
            </div>
          )}
```

por (mantendo os ScoreInputs já editados na Step 3 dentro do primeiro div):

```tsx
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-1.5">
                {/* ScoreInputs da Step 3 */}
              </div>

              {!locked && isKnockout && home !== "" && away !== "" && home === away && (
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                    Quem avança nos pênaltis?
                  </span>
                  <div className="flex gap-2">
                    <AdvanceButton
                      selected={advances === "HOME"}
                      name={match.home.name}
                      countryCode={match.home.countryCode}
                      onClick={() => { setAdvances("HOME"); save(home, away, "HOME"); }}
                    />
                    <AdvanceButton
                      selected={advances === "AWAY"}
                      name={match.away.name}
                      countryCode={match.away.countryCode}
                      onClick={() => { setAdvances("AWAY"); save(home, away, "AWAY"); }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
```

- [ ] **Step 5: Exibir o pick após o travamento**

No bloco `{(locked || isFinished) && match.bet && (...)}`, logo após o `<div>Meu palpite: ...</div>`, adicionar a linha de quem avança (quando houver pick):

```tsx
              {match.bet.advances && (
                <div className="flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  <Flag
                    countryCode={
                      match.bet.advances === "HOME"
                        ? match.home.countryCode
                        : match.away.countryCode
                    }
                    name={match.bet.advances === "HOME" ? match.home.name : match.away.name}
                    size={14}
                  />
                  <span>
                    {match.bet.advances === "HOME" ? match.home.name : match.away.name} nos
                    pênaltis
                  </span>
                </div>
              )}
```

- [ ] **Step 6: Aviso no `SaveBadge` quando falta escolher o pick**

Para dar feedback claro (em vez de ficar em silêncio), trocar a renderização do `SaveBadge` por uma que detecta o empate-sem-pick:

Onde está:

```tsx
          {/* Status do autosave */}
          {!locked && (
            <SaveBadge state={saveState} hasBet={!!match.bet} />
          )}
```

por:

```tsx
          {/* Status do autosave */}
          {!locked &&
            (isKnockout && home !== "" && away !== "" && home === away && advances === "" ? (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Escolha quem avança nos pênaltis
              </p>
            ) : (
              <SaveBadge state={saveState} hasBet={!!match.bet} />
            ))}
```

- [ ] **Step 7: Adicionar o componente `AdvanceButton`**

Ao final de `match-card.tsx` (junto aos outros sub-componentes), adicionar:

```tsx
function AdvanceButton({
  selected,
  name,
  countryCode,
  onClick,
}: {
  selected: boolean;
  name: string;
  countryCode: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors",
        selected
          ? "border-primary bg-primary/15 text-primary"
          : "border-input bg-secondary/60 text-muted-foreground hover:text-foreground",
      )}
    >
      <Flag countryCode={countryCode} name={name} size={16} />
      <span>{name}</span>
    </button>
  );
}
```

- [ ] **Step 8: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: sem erros.

- [ ] **Step 9: Verificação manual no app**

Subir o app (`npm run dev`) e, num bolão com jogo de mata-mata `SCHEDULED` aberto:
1. Digitar placar **não-empate** (ex.: 2 × 1) → salva normal ("Salvo"); sem seletor.
2. Digitar **empate** (ex.: 1 × 1) → aparece "Quem avança nos pênaltis?" e o badge "Escolha quem avança nos pênaltis"; **não** salva ainda.
3. Escolher um time → salva ("Salvo").
4. Recarregar → o pick persiste (botão correto fica selecionado).
5. Trocar para não-empate → seletor some e salva sem pick.

> Não há harness de teste de componente no projeto; esta verificação é manual.

- [ ] **Step 10: Commit**

```bash
git add src/components/match/match-card.tsx
git commit -m "feat(ui): seletor de quem avanca nos penaltis no card do mata-mata

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Correção do salvamento (Parte 1) → Task 1 ✅
- enum `Advance` + `Bet.advances` + `Match.penaltyWinner` → Task 2 ✅
- `POINTS_PENALTY_ADVANCE` constante → Task 3 ✅
- `advances` no `betSchema` → Task 3 ✅
- Obrigatoriedade do pick no empate de mata-mata → Task 3 (`isKnockoutDraw`) + Task 4 (server) + Task 9 (client) ✅
- Bônus de pontuação → Task 5 ✅
- Origem real do `penaltyWinner` (sync) → Task 6 ✅
- Origem real do `penaltyWinner` (admin manual) → Task 7 ✅
- Propagação para a UI → Task 8 ✅
- UI do seletor + exibição (só no card) → Task 9 ✅
- Fora de escopo (grupos, bracket, configurável, tela de confronto) → respeitado (sem tasks) ✅

**Placeholder scan:** Sem TBD/TODO; todo passo de código mostra o código.

**Type consistency:** `Advance` (`"HOME" | "AWAY"`) usado de forma uniforme; `computeBetPoints` 4º parâmetro `{ betAdvances, penaltyWinner, bonus }` idêntico entre Task 5 (def) e seu uso; `isBetClosed`/`isKnockoutDraw` com assinaturas estáveis entre Tasks 1/3/4; `MatchWithBet.bet.advances` e `MatchWithBet.penaltyWinner` consistentes entre Tasks 8 e 9.
