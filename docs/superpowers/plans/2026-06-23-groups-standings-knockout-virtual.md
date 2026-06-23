# Groups Standings & Knockout Virtual Matches Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real group standings with official FIFA tiebreakers, show in-memory R32 virtual bracket driven by current standings, and release knockout bets via OR gate (27/06 23h BRT ∨ all GROUP matches FINISHED).

**Architecture:** Pure function `computeGroupStandings()` in `src/lib/group.ts` powers both the standings table and R32 bracket resolution. `src/lib/bracket.ts` defines the FIFA 2026 R32 slot structure and resolves slots to actual teams using standings. Server function `getKnockoutMatchesWithVirtual()` merges DB matches with in-memory virtual ones. `PhaseView` renders `VirtualMatchCard` for virtual slots, `MatchCard` for real matches. No DB schema changes needed — virtual matches are ephemeral.

**Tech Stack:** Next.js 14 App Router, Prisma 6, vitest ^2.1.9, Tailwind CSS, TypeScript strict.

## Global Constraints

- All user-facing copy in pt-BR
- No new npm dependencies
- Pure functions (unit-testable) in `src/lib/`; server functions in `src/server/services/`; UI components in `src/components/`
- Test runner: `npm run test` (vitest run)
- TypeScript strict mode — no `any`
- Tailwind utility classes only; follow existing component patterns
- Frequent commits — one per task

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/lib/group.ts` | Modify | Add `TeamStanding` interface + `computeGroupStandings()` |
| `src/lib/group.test.ts` | Create | Unit tests for `computeGroupStandings()` |
| `src/lib/bracket.ts` | Create | FIFA 2026 R32 bracket constant + `resolveSlot()` + `findBest3rd()` |
| `src/lib/bracket.test.ts` | Create | Unit tests for bracket resolution |
| `src/lib/constants.ts` | Modify | Add `KNOCKOUT_UNLOCK_DATE` |
| `src/server/services/matches.ts` | Modify | Extend `MatchWithBet` to explicit interface; add `isKnockoutUnlocked()` + `getKnockoutMatchesWithVirtual()` |
| `src/server/services/groups.ts` | Modify | `getGroupsWithMatches()` returns `standings: TeamStanding[]` |
| `src/components/groups/groups-grid.tsx` | Modify | Add standings table inside each group card |
| `src/components/knockout/virtual-match-card.tsx` | Create | Locked card for virtual/TBD knockout matches |
| `src/components/knockout/phase-view.tsx` | Modify | Render `VirtualMatchCard` for `isVirtual` matches; drop `EmptyPhase` for knockout |
| `src/app/(app)/knockout/page.tsx` | Modify | Use `isKnockoutUnlocked()` + `getKnockoutMatchesWithVirtual()` |

---

### Task 1: Time Gate — `KNOCKOUT_UNLOCK_DATE` + `isKnockoutUnlocked()`

**Files:**
- Modify: `src/lib/constants.ts`
- Modify: `src/server/services/matches.ts`

**Interfaces:**
- Produces: `KNOCKOUT_UNLOCK_DATE: Date` (exported from constants); `isKnockoutUnlocked(): Promise<boolean>` (exported from matches service)

- [ ] **Step 1: Add `KNOCKOUT_UNLOCK_DATE` to constants**

Open `src/lib/constants.ts` and append after the existing exports:

```ts
/** Liberação dos palpites do mata-mata: 27/06/2026 às 23h BRT = 02:00 UTC de 28/06. */
export const KNOCKOUT_UNLOCK_DATE = new Date("2026-06-28T02:00:00.000Z");
```

- [ ] **Step 2: Add `isKnockoutUnlocked()` to matches service**

Open `src/server/services/matches.ts`. At the top, add the import:

```ts
import { KNOCKOUT_UNLOCK_DATE } from "@/lib/constants";
```

Then append after `isGroupStageComplete()`:

```ts
/**
 * Libera palpites do mata-mata quando ocorrer o PRIMEIRO de:
 * - Todos os jogos GROUP finalizados
 * - Data/hora 27/06/2026 às 23h BRT (02:00 UTC do dia 28)
 */
export async function isKnockoutUnlocked(): Promise<boolean> {
  if (new Date() >= KNOCKOUT_UNLOCK_DATE) return true;
  return isGroupStageComplete();
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```
git add src/lib/constants.ts src/server/services/matches.ts
git commit -m "feat: KNOCKOUT_UNLOCK_DATE + isKnockoutUnlocked (OR gate 27/06 23h BRT)"
```

---

### Task 2: Group Standings Pure Function + Tests

**Files:**
- Modify: `src/lib/group.ts`
- Create: `src/lib/group.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface TeamStanding {
    teamId: string; name: string; countryCode: string;
    played: number; won: number; drawn: number; lost: number;
    goalsFor: number; goalsAgainst: number; goalDiff: number;
    points: number; position: number;
  }
  export function computeGroupStandings(
    teams: Array<{ id: string; name: string; countryCode: string }>,
    matches: Array<{ homeTeamId: string; awayTeamId: string; homeScore: number | null; awayScore: number | null }>,
  ): TeamStanding[]
  ```

- [ ] **Step 1: Write the failing tests**

Create `src/lib/group.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeGroupStandings } from "./group";

const T = [
  { id: "BRA", name: "Brasil",    countryCode: "BR" },
  { id: "ARG", name: "Argentina", countryCode: "AR" },
  { id: "URU", name: "Uruguai",   countryCode: "UY" },
  { id: "PAR", name: "Paraguai",  countryCode: "PY" },
];

function m(h: string, a: string, hg: number, ag: number) {
  return { homeTeamId: h, awayTeamId: a, homeScore: hg, awayScore: ag };
}

describe("computeGroupStandings", () => {
  it("retorna 4 times com posição 1–4 e stats zerados sem partidas", () => {
    const s = computeGroupStandings(T, []);
    expect(s).toHaveLength(4);
    expect(s.map((x) => x.position)).toEqual([1, 2, 3, 4]);
    s.forEach((x) => {
      expect(x.played).toBe(0);
      expect(x.points).toBe(0);
    });
  });

  it("ordena por pontos: vencedor com 3pts aparece em 1°", () => {
    const s = computeGroupStandings(T, [m("BRA", "ARG", 2, 0)]);
    expect(s[0].teamId).toBe("BRA");
    expect(s[0].points).toBe(3);
    expect(s[0].played).toBe(1);
    expect(s[0].won).toBe(1);
    expect(s[1].teamId).toBe("ARG");
    expect(s[1].lost).toBe(1);
  });

  it("desempate por saldo de gols", () => {
    const s = computeGroupStandings(T, [
      m("BRA", "URU", 3, 1), // BRA 3pts GD+2
      m("ARG", "PAR", 2, 1), // ARG 3pts GD+1
    ]);
    expect(s[0].teamId).toBe("BRA");
    expect(s[1].teamId).toBe("ARG");
  });

  it("desempate por gols marcados quando SG igual", () => {
    const s = computeGroupStandings(T, [
      m("BRA", "URU", 2, 1), // BRA 3pts GD+1 GF=2
      m("ARG", "PAR", 3, 2), // ARG 3pts GD+1 GF=3
    ]);
    expect(s[0].teamId).toBe("ARG"); // ARG tem mais gols
    expect(s[1].teamId).toBe("BRA");
  });

  it("aplica confronto direto quando pts + SG + GF são iguais", () => {
    // BRA e ARG: 4pts, GD=0, GF=2 — mas BRA ganhou o H2H
    const s = computeGroupStandings(T, [
      m("BRA", "ARG", 1, 0), // BRA H2H win
      m("URU", "BRA", 1, 0), // BRA perde → saldo BRA: GF=1+0=1... não. Veja abaixo:
      // BRA: W(ARG 1-0) + L(URU 0-1) + D(PAR 1-1) → 4pts GF=2 GA=2 GD=0
      // ARG: L(BRA 0-1) + W(URU 2-1) + D(PAR 0-0) → 4pts GF=2 GA=2 GD=0
      m("BRA", "PAR", 1, 1),
      m("ARG", "URU", 2, 1),
      m("ARG", "PAR", 0, 0),
      m("URU", "PAR", 0, 1),
    ]);
    const braPos = s.find((x) => x.teamId === "BRA")!.position;
    const argPos = s.find((x) => x.teamId === "ARG")!.position;
    expect(braPos).toBeLessThan(argPos); // BRA ganha H2H vs ARG
  });

  it("empate circular no H2H mantém ordem estável", () => {
    const three = [
      { id: "A", name: "A", countryCode: "XX" },
      { id: "B", name: "B", countryCode: "YY" },
      { id: "C", name: "C", countryCode: "ZZ" },
    ];
    // A→B, B→C, C→A (todos 1V1D): todos idênticos — sort estável
    const s = computeGroupStandings(three, [
      m("A", "B", 2, 1),
      m("B", "C", 2, 1),
      m("C", "A", 2, 1),
    ]);
    expect(s.map((x) => x.teamId)).toEqual(["A", "B", "C"]);
  });

  it("ignora partidas sem placar definido", () => {
    const matches = [
      { homeTeamId: "BRA", awayTeamId: "ARG", homeScore: null, awayScore: null },
    ];
    const s = computeGroupStandings(T, matches);
    s.forEach((x) => expect(x.played).toBe(0));
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```
npm run test -- group.test
```

Expected: all tests FAIL with "computeGroupStandings is not a function" or similar.

- [ ] **Step 3: Implement `TeamStanding` and `computeGroupStandings` in `group.ts`**

Open `src/lib/group.ts` and append (keep the existing `normalizeGroup` function):

```ts
export interface TeamStanding {
  teamId: string;
  name: string;
  countryCode: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  position: number;
}

interface MatchForStandings {
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
}

/**
 * Critérios FIFA 2026 (em ordem):
 * 1. Pontos · 2. Saldo de gols · 3. Gols marcados
 * 4-6. H2H (pontos / saldo / gols) entre empatados
 * 7. Fair play (não implementado) · 8. Estabilidade
 */
export function computeGroupStandings(
  teams: Array<{ id: string; name: string; countryCode: string }>,
  matches: MatchForStandings[],
): TeamStanding[] {
  type Stats = Omit<TeamStanding, "position">;
  const map = new Map<string, Stats>();

  for (const t of teams) {
    map.set(t.id, {
      teamId: t.id, name: t.name, countryCode: t.countryCode,
      played: 0, won: 0, drawn: 0, lost: 0,
      goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0,
    });
  }

  const finished = matches.filter(
    (m) => m.homeScore != null && m.awayScore != null,
  );

  for (const m of finished) {
    const h = map.get(m.homeTeamId);
    const a = map.get(m.awayTeamId);
    if (!h || !a) continue;
    const hg = m.homeScore!, ag = m.awayScore!;

    h.played++; a.played++;
    h.goalsFor += hg; h.goalsAgainst += ag;
    a.goalsFor += ag; a.goalsAgainst += hg;
    h.goalDiff = h.goalsFor - h.goalsAgainst;
    a.goalDiff = a.goalsFor - a.goalsAgainst;

    if (hg > ag)      { h.won++; h.points += 3; a.lost++; }
    else if (hg < ag) { a.won++; a.points += 3; h.lost++; }
    else              { h.drawn++; h.points++; a.drawn++; a.points++; }
  }

  // Pass 1: pontos → saldo geral → gols marcados
  const sorted = [...map.values()].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
    return b.goalsFor - a.goalsFor;
  });

  // Pass 2: dentro de grupos ainda empatados, aplica H2H
  const result: Stats[] = [];
  let i = 0;
  while (i < sorted.length) {
    const ref = sorted[i];
    let j = i + 1;
    while (
      j < sorted.length &&
      sorted[j].points === ref.points &&
      sorted[j].goalDiff === ref.goalDiff &&
      sorted[j].goalsFor === ref.goalsFor
    ) j++;

    const chunk = sorted.slice(i, j);
    result.push(...(chunk.length > 1 ? applyH2H(chunk, finished) : chunk));
    i = j;
  }

  return result.map((t, idx) => ({ ...t, position: idx + 1 }));
}

function applyH2H(
  tied: Array<Omit<TeamStanding, "position">>,
  allMatches: MatchForStandings[],
): Array<Omit<TeamStanding, "position">> {
  const ids = new Set(tied.map((t) => t.teamId));
  const h2h = new Map<string, { pts: number; gd: number; gf: number }>();
  for (const t of tied) h2h.set(t.teamId, { pts: 0, gd: 0, gf: 0 });

  for (const m of allMatches) {
    if (!ids.has(m.homeTeamId) || !ids.has(m.awayTeamId)) continue;
    const hg = m.homeScore!, ag = m.awayScore!;
    const ho = h2h.get(m.homeTeamId)!;
    const aw = h2h.get(m.awayTeamId)!;
    ho.gd += hg - ag; aw.gd += ag - hg;
    ho.gf += hg; aw.gf += ag;
    if (hg > ag)      ho.pts += 3;
    else if (hg < ag) aw.pts += 3;
    else              { ho.pts++; aw.pts++; }
  }

  return [...tied].sort((a, b) => {
    const ha = h2h.get(a.teamId)!, hb = h2h.get(b.teamId)!;
    if (hb.pts !== ha.pts) return hb.pts - ha.pts;
    if (hb.gd !== ha.gd) return hb.gd - ha.gd;
    return hb.gf - ha.gf;
  });
}
```

- [ ] **Step 4: Run tests — all must pass**

```
npm run test -- group.test
```

Expected: all 7 tests PASS.

- [ ] **Step 5: Typecheck**

```
npm run typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```
git add src/lib/group.ts src/lib/group.test.ts
git commit -m "feat: computeGroupStandings com critérios FIFA 2026 (pontos → SG → GF → H2H)"
```

---

### Task 3: FIFA 2026 Bracket Constant + Resolution Logic + Tests

**Files:**
- Create: `src/lib/bracket.ts`
- Create: `src/lib/bracket.test.ts`

**Interfaces:**
- Consumes: `TeamStanding` from `src/lib/group.ts`
- Produces:
  ```ts
  export type BracketSlot = { kind: "group_1" | "group_2"; group: string; label: string }
                          | { kind: "best_3"; groups: string[]; label: string }
                          | { kind: "winner_r32" | "winner_r16" | "winner_qf"; n: number; label: string }
                          | { kind: "loser_sf"; n: number; label: string }
  export interface BracketMatch { slotLabel: string; home: BracketSlot; away: BracketSlot }
  export const FIFA_2026_R32: BracketMatch[]   // 16 entries
  export const FIFA_2026_R16: BracketMatch[]   // 8 entries
  export const FIFA_2026_QF:  BracketMatch[]   // 4 entries
  export const FIFA_2026_SF:  BracketMatch[]   // 2 entries
  export const FIFA_2026_THIRD: BracketMatch[] // 1 entry
  export const FIFA_2026_FINAL: BracketMatch[] // 1 entry
  export function resolveSlot(slot: BracketSlot, standings: Map<string, TeamStanding[]>): { team: { name: string; countryCode: string } | null; label: string }
  ```

- [ ] **Step 1: Fetch R32 match order from football-data.org (one-time reference)**

Run the following to see the R32 match ordering (matchday 1–16) with venues and dates:

```
npx tsx -e "
import { config } from 'dotenv'; config({ path: '.env.local' });
const r = await fetch('https://api.football-data.org/v4/competitions/2000/matches', {
  headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_TOKEN ?? '' }
});
const { matches } = await r.json() as any;
const r32 = (matches as any[])
  .filter(m => m.stage === 'LAST_32')
  .sort((a, b) => a.matchday - b.matchday);
r32.forEach(m => console.log(
  'md' + m.matchday,
  m.utcDate.slice(0, 10),
  m.venue?.slice(0, 20).padEnd(20),
  JSON.stringify(m.homeTeam),
  'x',
  JSON.stringify(m.awayTeam)
));
"
```

Use the output (matchday number → date/venue → home/away team placeholders) together with the official FIFA 2026 bracket table (available at fifa.com/en/tournaments/mens/worldcup/2026canada-mexico-usa/bracket) to populate `FIFA_2026_R32` in the next step. The matchday number maps to "segunda fase N" (matchday 1 → "segunda fase 1", etc.).

- [ ] **Step 2: Write failing tests for `resolveSlot` and `findBest3rd`**

Create `src/lib/bracket.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolveSlot, type BracketSlot } from "./bracket";
import type { TeamStanding } from "./group";

function standing(overrides: Partial<TeamStanding> & { teamId: string; name: string; countryCode: string }): TeamStanding {
  return {
    played: 3, won: 1, drawn: 1, lost: 1,
    goalsFor: 3, goalsAgainst: 3, goalDiff: 0, points: 4, position: 3,
    ...overrides,
  };
}

const standings = new Map<string, TeamStanding[]>([
  ["A", [
    standing({ teamId: "MEX", name: "México",      countryCode: "MX", position: 1, points: 7 }),
    standing({ teamId: "USA", name: "EUA",          countryCode: "US", position: 2, points: 5 }),
    standing({ teamId: "CAN", name: "Canadá",       countryCode: "CA", position: 3, points: 3 }),
    standing({ teamId: "HON", name: "Honduras",     countryCode: "HN", position: 4, points: 0 }),
  ]],
  ["B", [
    standing({ teamId: "BRA", name: "Brasil",       countryCode: "BR", position: 1, points: 9 }),
    standing({ teamId: "ARG", name: "Argentina",    countryCode: "AR", position: 2, points: 6 }),
    standing({ teamId: "URU", name: "Uruguai",      countryCode: "UY", position: 3, points: 2 }),
    standing({ teamId: "PAR", name: "Paraguai",     countryCode: "PY", position: 4, points: 0 }),
  ]],
  ["C", [
    standing({ teamId: "GER", name: "Alemanha",     countryCode: "DE", position: 1, points: 7 }),
    standing({ teamId: "ESP", name: "Espanha",      countryCode: "ES", position: 2, points: 5 }),
    standing({ teamId: "ITA", name: "Itália",       countryCode: "IT", position: 3, points: 3 }),
    standing({ teamId: "SUI", name: "Suíça",        countryCode: "CH", position: 4, points: 1 }),
  ]],
]);

describe("resolveSlot", () => {
  it("group_1 retorna o 1° do grupo", () => {
    const slot: BracketSlot = { kind: "group_1", group: "A", label: "1°A" };
    const r = resolveSlot(slot, standings);
    expect(r.label).toBe("1°A");
    expect(r.team?.name).toBe("México");
    expect(r.team?.countryCode).toBe("MX");
  });

  it("group_2 retorna o 2° do grupo", () => {
    const slot: BracketSlot = { kind: "group_2", group: "B", label: "2°B" };
    const r = resolveSlot(slot, standings);
    expect(r.team?.name).toBe("Argentina");
  });

  it("grupo sem dados retorna null", () => {
    const slot: BracketSlot = { kind: "group_1", group: "Z", label: "1°Z" };
    const r = resolveSlot(slot, standings);
    expect(r.team).toBeNull();
  });

  it("best_3 retorna o melhor 3° entre os grupos indicados", () => {
    // Grupo B 3° tem 2pts, Grupo C 3° tem 3pts → C ganha
    const slot: BracketSlot = { kind: "best_3", groups: ["B", "C"], label: "3°BC" };
    const r = resolveSlot(slot, standings);
    expect(r.team?.name).toBe("Itália"); // ITA tem 3pts vs URU 2pts
  });

  it("best_3 retorna null quando nenhum grupo tem 3° colocado", () => {
    const slot: BracketSlot = { kind: "best_3", groups: ["Z"], label: "3°Z" };
    const r = resolveSlot(slot, standings);
    expect(r.team).toBeNull();
  });

  it("winner_r32 sempre retorna null (não resolvível em memória)", () => {
    const slot: BracketSlot = { kind: "winner_r32", n: 1, label: "Venc. R32-1" };
    const r = resolveSlot(slot, standings);
    expect(r.team).toBeNull();
    expect(r.label).toBe("Venc. R32-1");
  });
});
```

- [ ] **Step 3: Run tests to confirm they fail**

```
npm run test -- bracket.test
```

Expected: FAIL — `bracket.ts` does not exist yet.

- [ ] **Step 4: Create `src/lib/bracket.ts`**

```ts
import type { MatchStage } from "@prisma/client";
import type { TeamStanding } from "./group";

// ─── Types ───────────────────────────────────────────────────────────────────

export type BracketSlot =
  | { kind: "group_1"; group: string; label: string }
  | { kind: "group_2"; group: string; label: string }
  | { kind: "best_3"; groups: string[]; label: string }
  | { kind: "winner_r32"; n: number; label: string }
  | { kind: "winner_r16"; n: number; label: string }
  | { kind: "winner_qf"; n: number; label: string }
  | { kind: "loser_sf"; n: number; label: string };

export interface BracketMatch {
  slotLabel: string;
  home: BracketSlot;
  away: BracketSlot;
}

// ─── FIFA 2026 Bracket Constants ─────────────────────────────────────────────
// Fonte: FIFA.com/en/tournaments/mens/worldcup/2026canada-mexico-usa/bracket
// Verificar matchday ordering via football-data.org API (LAST_32 stage).
// Exemplos confirmados pelas imagens de referência:
//   md1: 1°E vs 3°(A/B/C/D/F)   — Boston
//   md2: 1°I vs 3°(C/D/F/G/H)   — New Jersey
//   md3: 2°A vs 2°B              — Los Angeles

export const FIFA_2026_R32: BracketMatch[] = [
  // md1
  { slotLabel: "segunda fase 1",  home: { kind: "group_1", group: "E", label: "1°E" },  away: { kind: "best_3", groups: ["A","B","C","D","F"], label: "3°ABCDF" } },
  // md2
  { slotLabel: "segunda fase 2",  home: { kind: "group_1", group: "I", label: "1°I" },  away: { kind: "best_3", groups: ["C","D","F","G","H"], label: "3°CDFGH" } },
  // md3
  { slotLabel: "segunda fase 3",  home: { kind: "group_2", group: "A", label: "2°A" },  away: { kind: "group_2", group: "B", label: "2°B" } },
  // md4 — preencher com resultado do fetch da API
  { slotLabel: "segunda fase 4",  home: { kind: "group_1", group: "A", label: "1°A" },  away: { kind: "best_3", groups: ["D","E","F","G","H"], label: "3°DEFGH" } },
  // md5
  { slotLabel: "segunda fase 5",  home: { kind: "group_1", group: "C", label: "1°C" },  away: { kind: "best_3", groups: ["A","B","E","I","J"], label: "3°ABEIJ" } },
  // md6
  { slotLabel: "segunda fase 6",  home: { kind: "group_2", group: "C", label: "2°C" },  away: { kind: "group_2", group: "D", label: "2°D" } },
  // md7
  { slotLabel: "segunda fase 7",  home: { kind: "group_1", group: "B", label: "1°B" },  away: { kind: "group_2", group: "I", label: "2°I" } },
  // md8
  { slotLabel: "segunda fase 8",  home: { kind: "group_2", group: "E", label: "2°E" },  away: { kind: "group_2", group: "H", label: "2°H" } },
  // md9
  { slotLabel: "segunda fase 9",  home: { kind: "group_1", group: "D", label: "1°D" },  away: { kind: "best_3", groups: ["E","F","G","I","J"], label: "3°EFGIJ" } },
  // md10
  { slotLabel: "segunda fase 10", home: { kind: "group_1", group: "H", label: "1°H" },  away: { kind: "group_2", group: "G", label: "2°G" } },
  // md11
  { slotLabel: "segunda fase 11", home: { kind: "group_1", group: "F", label: "1°F" },  away: { kind: "best_3", groups: ["G","H","I","J","K"], label: "3°GHIJK" } },
  // md12
  { slotLabel: "segunda fase 12", home: { kind: "group_2", group: "F", label: "2°F" },  away: { kind: "best_3", groups: ["A","B","C","K","L"], label: "3°ABCKL" } },
  // md13
  { slotLabel: "segunda fase 13", home: { kind: "group_1", group: "G", label: "1°G" },  away: { kind: "group_2", group: "J", label: "2°J" } },
  // md14
  { slotLabel: "segunda fase 14", home: { kind: "group_2", group: "K", label: "2°K" },  away: { kind: "group_2", group: "L", label: "2°L" } },
  // md15
  { slotLabel: "segunda fase 15", home: { kind: "group_1", group: "K", label: "1°K" },  away: { kind: "best_3", groups: ["D","E","H","J","L"], label: "3°DEHJL" } },
  // md16
  { slotLabel: "segunda fase 16", home: { kind: "group_1", group: "J", label: "1°J" },  away: { kind: "group_1", group: "L", label: "1°L" } },
];

// R16: vencedores do R32 se enfrentam em pares sequenciais (1 vs 2, 3 vs 4, ...)
export const FIFA_2026_R16: BracketMatch[] = Array.from({ length: 8 }, (_, i) => ({
  slotLabel: `oitavas ${i + 1}`,
  home: { kind: "winner_r32" as const, n: i * 2 + 1, label: `Venc. R32-${i * 2 + 1}` },
  away: { kind: "winner_r32" as const, n: i * 2 + 2, label: `Venc. R32-${i * 2 + 2}` },
}));

export const FIFA_2026_QF: BracketMatch[] = Array.from({ length: 4 }, (_, i) => ({
  slotLabel: `quartas ${i + 1}`,
  home: { kind: "winner_r16" as const, n: i * 2 + 1, label: `Venc. Oitavas ${i * 2 + 1}` },
  away: { kind: "winner_r16" as const, n: i * 2 + 2, label: `Venc. Oitavas ${i * 2 + 2}` },
}));

export const FIFA_2026_SF: BracketMatch[] = Array.from({ length: 2 }, (_, i) => ({
  slotLabel: `semifinal ${i + 1}`,
  home: { kind: "winner_qf" as const, n: i * 2 + 1, label: `Venc. Quartas ${i * 2 + 1}` },
  away: { kind: "winner_qf" as const, n: i * 2 + 2, label: `Venc. Quartas ${i * 2 + 2}` },
}));

export const FIFA_2026_THIRD: BracketMatch[] = [{
  slotLabel: "3° lugar",
  home: { kind: "loser_sf", n: 1, label: "Perd. Semif. 1" },
  away: { kind: "loser_sf", n: 2, label: "Perd. Semif. 2" },
}];

export const FIFA_2026_FINAL: BracketMatch[] = [{
  slotLabel: "final",
  home: { kind: "winner_qf", n: 5, label: "Venc. Semif. 1" },
  away: { kind: "winner_qf", n: 6, label: "Venc. Semif. 2" },
}];

// Map from MatchStage to bracket array
export const BRACKET_BY_STAGE: Partial<Record<MatchStage, BracketMatch[]>> = {
  R32: FIFA_2026_R32,
  R16: FIFA_2026_R16,
  QF: FIFA_2026_QF,
  SF: FIFA_2026_SF,
  THIRD_PLACE: FIFA_2026_THIRD,
  FINAL: FIFA_2026_FINAL,
};

// ─── Resolution ──────────────────────────────────────────────────────────────

/**
 * Resolve um slot do bracket para um time real (a partir dos standings atuais)
 * ou retorna null se o time ainda não pode ser determinado.
 */
export function resolveSlot(
  slot: BracketSlot,
  standings: Map<string, TeamStanding[]>,
): { team: { name: string; countryCode: string } | null; label: string } {
  if (slot.kind === "group_1") {
    const team = standings.get(slot.group)?.[0];
    return { team: team ? { name: team.name, countryCode: team.countryCode } : null, label: slot.label };
  }
  if (slot.kind === "group_2") {
    const team = standings.get(slot.group)?.[1];
    return { team: team ? { name: team.name, countryCode: team.countryCode } : null, label: slot.label };
  }
  if (slot.kind === "best_3") {
    const team = findBest3rd(standings, slot.groups);
    return { team, label: slot.label };
  }
  // winner_r32, winner_r16, winner_qf, loser_sf — não resolvíveis em memória
  return { team: null, label: slot.label };
}

/**
 * Determina o melhor 3° colocado entre os grupos indicados.
 * Ranking: pontos → saldo gols → gols marcados.
 * Retorna o time em posição 3 do grupo com melhor classificação entre allowedGroups.
 */
function findBest3rd(
  standings: Map<string, TeamStanding[]>,
  allowedGroups: string[],
): { name: string; countryCode: string } | null {
  type Entry = { name: string; countryCode: string; points: number; goalDiff: number; goalsFor: number };
  const thirds: Entry[] = [];

  for (const g of allowedGroups) {
    const groupStandings = standings.get(g);
    const third = groupStandings?.[2];
    if (third) {
      thirds.push({
        name: third.name,
        countryCode: third.countryCode,
        points: third.points,
        goalDiff: third.goalDiff,
        goalsFor: third.goalsFor,
      });
    }
  }

  if (thirds.length === 0) return null;

  thirds.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
    return b.goalsFor - a.goalsFor;
  });

  return { name: thirds[0].name, countryCode: thirds[0].countryCode };
}
```

> **Nota sobre os slots md4–md16:** Os valores de `groups` para slots `best_3` e os pares de `group_1`/`group_2` nos matchdays 4–16 precisam ser verificados com o chaveamento oficial FIFA 2026. Use a saída do fetch do Step 1 em conjunto com o bracket oficial em fifa.com para ajustar os que divergirem. As entradas md1, md2, md3 estão confirmadas pelas imagens de referência.

- [ ] **Step 5: Run tests — all must pass**

```
npm run test -- bracket.test
```

Expected: all 6 tests PASS.

- [ ] **Step 6: Typecheck**

```
npm run typecheck
```

Expected: no errors.

- [ ] **Step 7: Commit**

```
git add src/lib/bracket.ts src/lib/bracket.test.ts
git commit -m "feat: lib/bracket.ts — FIFA 2026 R32 constant + resolveSlot + findBest3rd"
```

---

### Task 4: Extend `MatchWithBet` + Update Services

**Files:**
- Modify: `src/server/services/matches.ts`
- Modify: `src/server/services/groups.ts`

**Interfaces:**
- Consumes:
  - `TeamStanding` from `src/lib/group.ts`
  - `computeGroupStandings()` from `src/lib/group.ts`
  - `BRACKET_BY_STAGE`, `BracketMatch`, `resolveSlot()` from `src/lib/bracket.ts`
  - `KNOCKOUT_UNLOCK_DATE` from `src/lib/constants.ts`
- Produces (updated `MatchWithBet`):
  ```ts
  export interface MatchWithBet {
    id: string; kickoffAt: Date; lockAt: Date; status: MatchStatus; stage: MatchStage;
    group: string | null; matchday: number | null; venue: string | null;
    homeScore: number | null; awayScore: number | null;
    home: { name: string; countryCode: string; crestUrl: string | null };
    away: { name: string; countryCode: string; crestUrl: string | null };
    bet: { homeGuess: number; awayGuess: number; pointsEarned: number } | null;
    isVirtual?: true;
    homeLabel?: string;
    awayLabel?: string;
    slotLabel?: string;
  }
  ```
- Produces: `getKnockoutMatchesWithVirtual(opts: { userId: string; poolId: string }): Promise<MatchWithBet[]>`
- Produces (updated): `getGroupsWithMatches()` returns `standings: TeamStanding[]` per group

- [ ] **Step 1: Replace derived `MatchWithBet` with explicit interface in `matches.ts`**

Open `src/server/services/matches.ts`. Find the line:

```ts
export type MatchWithBet = Awaited<ReturnType<typeof getMatchesWithBets>>[number];
```

Replace it with the explicit interface:

```ts
export interface MatchWithBet {
  id: string;
  kickoffAt: Date;
  lockAt: Date;
  status: MatchStatus;
  stage: MatchStage;
  group: string | null;
  matchday: number | null;
  venue: string | null;
  homeScore: number | null;
  awayScore: number | null;
  home: { name: string; countryCode: string; crestUrl: string | null };
  away: { name: string; countryCode: string; crestUrl: string | null };
  bet: { homeGuess: number; awayGuess: number; pointsEarned: number } | null;
  // Virtual match fields (in-memory only, never persisted):
  isVirtual?: true;
  homeLabel?: string;
  awayLabel?: string;
  slotLabel?: string;
}
```

- [ ] **Step 2: Add `getKnockoutMatchesWithVirtual()` to `matches.ts`**

Add imports at the top of `src/server/services/matches.ts`:

```ts
import { computeGroupStandings } from "@/lib/group";
import { BRACKET_BY_STAGE, resolveSlot } from "@/lib/bracket";
import { KNOCKOUT_UNLOCK_DATE } from "@/lib/constants";
import type { MatchStage } from "@prisma/client";
```

Then append the new function:

```ts
const KNOCKOUT_STAGES: MatchStage[] = ["R32", "R16", "QF", "SF", "THIRD_PLACE", "FINAL"];

/**
 * Todos os jogos do torneio (fases de grupo + eliminatórias).
 * Para fases sem partidas no BD, gera confrontos virtuais em memória:
 *   R32 → times resolvidos a partir dos standings atuais (bandeira quando possível)
 *   R16+ → labels de slot ("Venc. R32-1 vs Venc. R32-2")
 * Partidas virtuais têm isVirtual=true e lockAt=KNOCKOUT_UNLOCK_DATE.
 */
export async function getKnockoutMatchesWithVirtual(opts: {
  userId: string;
  poolId: string;
}): Promise<MatchWithBet[]> {
  const real = await getAllMatchesWithBets(opts);

  // Determine which knockout stages already have real matches in DB
  const stagesWithData = new Set(real.map((m) => m.stage));

  // Compute group standings from DB matches for R32 resolution
  const groupMatches = real.filter((m) => m.stage === "GROUP");
  const standingsMap = buildStandingsMap(groupMatches, real);

  const virtual: MatchWithBet[] = [];

  for (const stage of KNOCKOUT_STAGES) {
    if (stagesWithData.has(stage)) continue; // real data exists — skip virtual generation

    const bracketMatches = BRACKET_BY_STAGE[stage];
    if (!bracketMatches) continue;

    bracketMatches.forEach((bm, idx) => {
      const homeResolved = resolveSlot(bm.home, standingsMap);
      const awayResolved = resolveSlot(bm.away, standingsMap);

      virtual.push({
        id: `virtual-${stage}-${idx}`,
        kickoffAt: new Date(KNOCKOUT_UNLOCK_DATE.getTime() + idx * 60_000),
        lockAt: KNOCKOUT_UNLOCK_DATE,
        status: "SCHEDULED",
        stage,
        group: null,
        matchday: idx + 1,
        venue: null,
        homeScore: null,
        awayScore: null,
        home: {
          name: homeResolved.team?.name ?? homeResolved.label,
          countryCode: homeResolved.team?.countryCode ?? "",
          crestUrl: null,
        },
        away: {
          name: awayResolved.team?.name ?? awayResolved.label,
          countryCode: awayResolved.team?.countryCode ?? "",
          crestUrl: null,
        },
        bet: null,
        isVirtual: true,
        homeLabel: homeResolved.label,
        awayLabel: awayResolved.label,
        slotLabel: bm.slotLabel,
      });
    });
  }

  return [...real, ...virtual];
}

/**
 * Constrói o Map de standings por grupo a partir dos matches GROUP.
 * Necessita das teams dentro dos matches para montar os standings.
 */
function buildStandingsMap(
  groupMatches: MatchWithBet[],
  allMatches: MatchWithBet[],
): Map<string, ReturnType<typeof computeGroupStandings>> {
  // Collect unique teams per group from match participants
  const teamsByGroup = new Map<string, Array<{ id: string; name: string; countryCode: string }>>();
  const teamIdSet = new Map<string, { id: string; name: string; countryCode: string }>();

  for (const m of groupMatches) {
    const g = m.group ?? "";
    if (!teamsByGroup.has(g)) teamsByGroup.set(g, []);
    const group = teamsByGroup.get(g)!;
    // home
    if (!teamIdSet.has(`${g}-${m.home.name}`)) {
      const t = { id: `${g}-home-${m.home.name}`, name: m.home.name, countryCode: m.home.countryCode };
      teamIdSet.set(`${g}-${m.home.name}`, t);
      group.push(t);
    }
    // away
    if (!teamIdSet.has(`${g}-${m.away.name}`)) {
      const t = { id: `${g}-away-${m.away.name}`, name: m.away.name, countryCode: m.away.countryCode };
      teamIdSet.set(`${g}-${m.away.name}`, t);
      group.push(t);
    }
  }

  const standingsMap = new Map<string, ReturnType<typeof computeGroupStandings>>();

  for (const [group, teams] of teamsByGroup) {
    const matches = groupMatches
      .filter((m) => m.group === group)
      .map((m) => ({
        homeTeamId: teamIdSet.get(`${group}-${m.home.name}`)?.id ?? "",
        awayTeamId: teamIdSet.get(`${group}-${m.away.name}`)?.id ?? "",
        homeScore: m.homeScore,
        awayScore: m.awayScore,
      }));
    standingsMap.set(group, computeGroupStandings(teams, matches));
  }

  return standingsMap;
}
```

- [ ] **Step 3: Update `getGroupsWithMatches()` in `groups.ts` to return standings**

Open `src/server/services/groups.ts`. Add imports at the top:

```ts
import { computeGroupStandings, type TeamStanding } from "@/lib/group";
```

Find the `getGroupsWithMatches` function and replace the `return` statement at the bottom:

Old return:
```ts
  return [...teamsByGroup.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([letter, groupTeams]) => ({
      letter,
      teams: groupTeams,
      matches: matchesByGroup.get(letter) ?? [],
    }));
```

New return (compute standings before mapping):
```ts
  return [...teamsByGroup.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([letter, groupTeams]) => {
      const groupMatches = matchesByGroup.get(letter) ?? [];
      // Build match inputs for standings computation (need teamId per match row)
      const teamIdByName = new Map(groupTeams.map((t) => [t.name, t.id]));
      const matchInputs = groupMatches.map((m) => ({
        homeTeamId: teamIdByName.get(m.home.name) ?? "",
        awayTeamId: teamIdByName.get(m.away.name) ?? "",
        homeScore: m.homeScore,
        awayScore: m.awayScore,
      }));
      const standings = computeGroupStandings(groupTeams, matchInputs);
      return { letter, teams: groupTeams, standings, matches: groupMatches };
    });
```

- [ ] **Step 4: Typecheck**

```
npm run typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```
git add src/server/services/matches.ts src/server/services/groups.ts
git commit -m "feat: MatchWithBet virtual fields + getKnockoutMatchesWithVirtual + getGroupsWithMatches standings"
```

---

### Task 5: Groups Standings Table UI

**Files:**
- Modify: `src/components/groups/groups-grid.tsx`

**Interfaces:**
- Consumes: `standings: TeamStanding[]` from each group (added in Task 4)

- [ ] **Step 1: Update `GroupData` interface and add standings table**

Open `src/components/groups/groups-grid.tsx`. Replace the full file content:

```tsx
"use client";

import { useState } from "react";
import { Pencil, Lock } from "lucide-react";
import { Flag } from "@/components/flag";
import { MatchCard } from "@/components/match/match-card";
import { Dialog } from "@/components/ui/dialog";
import { isBettable, cn } from "@/lib/utils";
import type { MatchWithBet } from "@/server/services/matches";
import type { TeamStanding } from "@/lib/group";

interface GroupData {
  letter: string;
  teams: { id: string; name: string; countryCode: string }[];
  standings: TeamStanding[];
  matches: MatchWithBet[];
}

export function GroupsGrid({
  groups,
  poolId,
}: {
  groups: GroupData[];
  poolId: string;
}) {
  const [openLetter, setOpenLetter] = useState<string | null>(null);
  const active = groups.find((g) => g.letter === openLetter) ?? null;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((group) => {
          const openBets = group.matches.filter(
            (m) => isBettable(m.lockAt) && m.status === "SCHEDULED",
          ).length;
          const placed = group.matches.filter((m) => m.bet).length;

          return (
            <button
              key={group.letter}
              type="button"
              onClick={() => setOpenLetter(group.letter)}
              className="overflow-hidden rounded-2xl border border-border bg-card text-left transition-colors hover:border-primary"
            >
              <div className="flex items-center justify-between bg-primary/15 px-4 py-2">
                <h2 className="font-bold text-primary">Grupo {group.letter}</h2>
                <span className="flex items-center gap-1 text-xs font-medium text-primary">
                  <Pencil className="h-3 w-3" />
                  Palpitar
                </span>
              </div>

              {/* Tabela de classificação */}
              <div className="px-2 py-1">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="w-5 py-1 text-center font-medium">#</th>
                      <th className="py-1 text-left font-medium pl-1">Seleção</th>
                      <th className="w-7 py-1 text-center font-bold text-foreground">P</th>
                      <th className="w-6 py-1 text-center font-medium">J</th>
                      <th className="w-6 py-1 text-center font-medium">V</th>
                      <th className="w-6 py-1 text-center font-medium">E</th>
                      <th className="w-6 py-1 text-center font-medium">D</th>
                      <th className="w-8 py-1 text-center font-medium">SG</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {group.standings.map((s) => (
                      <tr key={s.teamId} className={cn(
                        "transition-colors",
                        s.position <= 2 && "bg-primary/5",
                      )}>
                        <td className="py-1.5 text-center text-muted-foreground">{s.position}</td>
                        <td className="py-1.5 pl-1">
                          <div className="flex items-center gap-1.5">
                            <Flag countryCode={s.countryCode} name={s.name} size={18} />
                            <span className="truncate max-w-[80px] font-medium">{s.name}</span>
                          </div>
                        </td>
                        <td className="py-1.5 text-center font-bold">{s.points}</td>
                        <td className="py-1.5 text-center text-muted-foreground">{s.played}</td>
                        <td className="py-1.5 text-center text-muted-foreground">{s.won}</td>
                        <td className="py-1.5 text-center text-muted-foreground">{s.drawn}</td>
                        <td className="py-1.5 text-center text-muted-foreground">{s.lost}</td>
                        <td className={cn(
                          "py-1.5 text-center",
                          s.goalDiff > 0 ? "text-primary" : s.goalDiff < 0 ? "text-destructive" : "text-muted-foreground",
                        )}>
                          {s.goalDiff > 0 ? `+${s.goalDiff}` : s.goalDiff}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground">
                <span>{group.matches.length} jogos</span>
                <span>
                  {placed} palpitados
                  {openBets === 0 && group.matches.length > 0 && (
                    <Lock className="ml-1 inline h-3 w-3" />
                  )}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <Dialog
        open={openLetter !== null}
        onClose={() => setOpenLetter(null)}
        title={active ? `Grupo ${active.letter}` : "Grupo"}
        description="Lance ou edite seus palpites desta chave · fecha 20 min antes de cada jogo"
      >
        {active && active.matches.length > 0 ? (
          active.matches.map((m) => (
            <MatchCard key={m.id} match={m} poolId={poolId} />
          ))
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Os jogos deste grupo ainda não foram definidos.
          </p>
        )}
      </Dialog>
    </>
  );
}
```

- [ ] **Step 2: Update `groups/page.tsx` to pass `standings` to `GroupsGrid`**

The `GroupsGrid` now expects `standings` in each group. Verify `src/app/(app)/groups/page.tsx` is passing the groups from `getGroupsWithMatches()` directly to `<GroupsGrid groups={groups} ...>`. Since `getGroupsWithMatches()` already returns `standings` after Task 4, no change is needed in the page — but verify typecheck passes.

```
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```
git add src/components/groups/groups-grid.tsx
git commit -m "feat: tabela de classificação nos cards de grupo (pontos/SG/vitórias)"
```

---

### Task 6: `VirtualMatchCard` + `PhaseView` Update

**Files:**
- Create: `src/components/knockout/virtual-match-card.tsx`
- Modify: `src/components/knockout/phase-view.tsx`

**Interfaces:**
- Consumes: `MatchWithBet` (with `isVirtual`, `homeLabel`, `awayLabel`, `slotLabel` fields)

- [ ] **Step 1: Create `VirtualMatchCard`**

Create `src/components/knockout/virtual-match-card.tsx`:

```tsx
import { Lock, Shield } from "lucide-react";
import { Flag } from "@/components/flag";
import { cn } from "@/lib/utils";
import { STAGE_LABEL } from "@/lib/labels";
import type { MatchWithBet } from "@/server/services/matches";

export function VirtualMatchCard({ match }: { match: MatchWithBet }) {
  const kickoff = new Date(match.kickoffAt);
  const dateStr = kickoff.toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit",
  });
  const weekday = kickoff.toLocaleDateString("pt-BR", { weekday: "short" });

  function TeamSlot({
    name, countryCode, label,
  }: { name: string; countryCode: string; label?: string }) {
    const resolved = countryCode.length > 0;
    return (
      <div className="flex flex-col items-center gap-2">
        {resolved ? (
          <Flag countryCode={countryCode} name={name} size={52} />
        ) : (
          <div className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-secondary">
            <Shield className="h-7 w-7 text-muted-foreground/50" />
          </div>
        )}
        <span className={cn(
          "text-center text-sm font-semibold leading-tight",
          !resolved && "text-muted-foreground",
        )}>
          {resolved ? name : (label ?? name)}
        </span>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/80">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between bg-secondary/30 px-4 py-2 text-xs font-medium text-muted-foreground">
        <span>
          {STAGE_LABEL[match.stage]}
          {match.slotLabel ? ` · ${match.slotLabel}` : ""}
        </span>
        <span className="flex items-center gap-1.5">
          <Lock className="h-3 w-3" />
          {dateStr} · {weekday}
        </span>
      </div>

      {/* Times */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-4 opacity-70">
        <TeamSlot
          name={match.home.name}
          countryCode={match.home.countryCode}
          label={match.homeLabel}
        />
        <span className="text-xl font-light text-muted-foreground">×</span>
        <TeamSlot
          name={match.away.name}
          countryCode={match.away.countryCode}
          label={match.awayLabel}
        />
      </div>

      {/* Rodapé */}
      {match.venue && (
        <div className="border-t border-border px-4 py-1.5 text-center text-xs text-muted-foreground">
          {match.venue}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update `PhaseView` to use `VirtualMatchCard` and remove `EmptyPhase` guard for knockout**

Open `src/components/knockout/phase-view.tsx`. Replace the full file content:

```tsx
"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MatchCard } from "@/components/match/match-card";
import { VirtualMatchCard } from "@/components/knockout/virtual-match-card";
import { STAGE_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { MatchWithBet } from "@/server/services/matches";
import type { MatchStage } from "@prisma/client";

const PHASES: MatchStage[] = ["GROUP", "R32", "R16", "QF", "SF", "THIRD_PLACE", "FINAL"];

const PREDICTED_START: Record<MatchStage, Date> = {
  GROUP:       new Date(2026, 5, 11),
  R32:         new Date(2026, 5, 28),
  R16:         new Date(2026, 6, 4),
  QF:          new Date(2026, 6, 9),
  SF:          new Date(2026, 6, 14),
  THIRD_PLACE: new Date(2026, 6, 18),
  FINAL:       new Date(2026, 6, 19),
};

function formatLongDate(d: Date) {
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
}

export function PhaseView({
  matches,
  poolId,
  groupComplete,
}: {
  matches: MatchWithBet[];
  poolId: string;
  groupComplete: boolean;
}) {
  const byStage = useMemo(() => {
    const map = new Map<MatchStage, MatchWithBet[]>();
    for (const m of matches) {
      if (!map.has(m.stage)) map.set(m.stage, []);
      map.get(m.stage)!.push(m);
    }
    return map;
  }, [matches]);

  const [idx, setIdx] = useState(() => {
    const firstKnockoutUnfinished = PHASES.findIndex(
      (s, i) =>
        i > 0 &&
        (byStage.get(s) ?? []).some((m) => m.status !== "FINISHED"),
    );
    return firstKnockoutUnfinished >= 0 ? firstKnockoutUnfinished : 1;
  });

  const stage = PHASES[idx];
  const stageMatches = byStage.get(stage) ?? [];
  const fill = ((idx + 1) / PHASES.length) * 100;

  const start = stageMatches[0]
    ? new Date(stageMatches[0].kickoffAt)
    : PREDICTED_START[stage];

  return (
    <div className="space-y-4">
      {/* Controle de fase */}
      <section aria-label="Fase da competição" className="space-y-3">
        <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${fill}%` }}
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Fase anterior"
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            disabled={idx === 0}
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-30"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <div className="flex-1 text-center">
            <h2 className="text-lg font-bold leading-tight">{STAGE_LABEL[stage]}</h2>
            <span className="text-xs text-muted-foreground">
              Fase {idx + 1} de {PHASES.length}
            </span>
          </div>
          <button
            type="button"
            aria-label="Próxima fase"
            onClick={() => setIdx((i) => Math.min(PHASES.length - 1, i + 1))}
            disabled={idx === PHASES.length - 1}
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-30"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>
      </section>

      {/* Conteúdo da fase */}
      {stageMatches.length > 0 ? (
        <div className="space-y-3">
          {stageMatches.map((m) =>
            m.isVirtual ? (
              <VirtualMatchCard key={m.id} match={m} />
            ) : (
              <MatchCard key={m.id} match={m} poolId={poolId} />
            ),
          )}
        </div>
      ) : (
        <EmptyPhase label={STAGE_LABEL[stage]} start={start} />
      )}
    </div>
  );
}

function EmptyPhase({ label, start }: { label: string; start: Date }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card px-6 py-12 text-center">
      <span className="text-5xl" aria-hidden>🏆</span>
      <h3 className="text-lg font-semibold">{label}</h3>
      <p className="text-sm font-medium capitalize text-primary">
        Previsto para começar em {formatLongDate(start)}.
      </p>
    </div>
  );
}
```

> Note: `groupComplete` prop is kept for API compatibility but virtual match locking is now handled via `match.lockAt` + `isBettable()` inside `MatchCard`. If you want to remove the prop, check all call sites first.

- [ ] **Step 3: Typecheck**

```
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```
git add src/components/knockout/virtual-match-card.tsx src/components/knockout/phase-view.tsx
git commit -m "feat: VirtualMatchCard + PhaseView renderiza confrontos virtuais do R32"
```

---

### Task 7: Page Wiring + Smoke Test

**Files:**
- Modify: `src/app/(app)/knockout/page.tsx`

- [ ] **Step 1: Update `knockout/page.tsx`**

Open `src/app/(app)/knockout/page.tsx`. Make two changes:

1. Replace import of `getAllMatchesWithBets` with `getKnockoutMatchesWithVirtual`:

```diff
 import {
   getUserPools,
-  getAllMatchesWithBets,
-  isGroupStageComplete,
+  getKnockoutMatchesWithVirtual,
+  isKnockoutUnlocked,
 } from "@/server/services/matches";
```

2. Replace the `Promise.all` call:

```diff
-  const [matches, groupComplete] = await Promise.all([
-    getAllMatchesWithBets({ userId, poolId: selected.id }),
-    isGroupStageComplete(),
-  ]);
+  const [matches, groupComplete] = await Promise.all([
+    getKnockoutMatchesWithVirtual({ userId, poolId: selected.id }),
+    isKnockoutUnlocked(),
+  ]);
```

- [ ] **Step 2: Typecheck**

```
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Run full test suite**

```
npm run test
```

Expected: all tests PASS (no regressions).

- [ ] **Step 4: Manual smoke test — verify `/knockout` page**

Start the dev server:

```
npm run dev
```

Open `http://localhost:3000/knockout` and verify:

1. **Fase "16-avos" (R32)** appears by default with cards showing:
   - Known group leaders/runners-up with flags (e.g., if Group A has finished, shows actual team)
   - Slots without data show shield icon + label (e.g., "1°E" when Group E hasn't finished)
   - Cards are visually locked (no bet inputs)
2. **Fase "Oitavas"** shows cards with "Venc. R32-1 vs Venc. R32-2" style labels + shield icons
3. **Navigation arrows** switch between phases correctly
4. **`/groups` page** shows standings table inside each group card with columns P/J/V/E/D/SG

- [ ] **Step 5: Commit**

```
git add src/app/(app)/knockout/page.tsx
git commit -m "feat: knockout page usa isKnockoutUnlocked + getKnockoutMatchesWithVirtual"
```

---

## Self-Review

### Spec Coverage

| Spec Requirement | Task |
|---|---|
| `computeGroupStandings()` com 8 critérios FIFA | Task 2 |
| `TeamStanding` interface | Task 2 |
| `lib/bracket.ts` com tipos + constante FIFA 2026 + `resolveSlot()` | Task 3 |
| `findBest3rd()` | Task 3 |
| `KNOCKOUT_UNLOCK_DATE` | Task 1 |
| `isKnockoutUnlocked()` (OR gate) | Task 1 |
| Extend `MatchWithBet` com campos virtuais | Task 4 |
| `getKnockoutMatchesWithVirtual()` | Task 4 |
| `getGroupsWithMatches()` retorna `standings` | Task 4 |
| `GroupsGrid` com tabela de standings | Task 5 |
| `VirtualMatchCard` component | Task 6 |
| `PhaseView` renderiza virtual vs real | Task 6 |
| `knockout/page.tsx` wiring | Task 7 |

Todos os requisitos do spec cobertos. ✅

### Type Consistency

- `TeamStanding` definido em Task 2, consumido em Tasks 3, 4, 5 — nomes consistentes.
- `MatchWithBet` explicitado em Task 4, consumido em Tasks 5, 6, 7 — campos opcionais `isVirtual`, `homeLabel`, `awayLabel`, `slotLabel` usados consistentemente.
- `BracketSlot.kind` values: `"group_1"`, `"group_2"`, `"best_3"`, `"winner_r32"`, `"winner_r16"`, `"winner_qf"`, `"loser_sf"` — usados consistentemente entre bracket.ts e seus testes.
- `resolveSlot()` chamado em `getKnockoutMatchesWithVirtual()` com a assinatura correta.

### Known Limitation

Os 13 matchdays do R32 (md4–md16) na constante `FIFA_2026_R32` devem ter seus slots `best_3` e pares de grupo verificados contra o bracket oficial FIFA 2026 durante o Step 1 da Task 3. Os valores inseridos são uma melhor estimativa; os 3 primeiros (md1–md3) estão confirmados pelas imagens de referência.
