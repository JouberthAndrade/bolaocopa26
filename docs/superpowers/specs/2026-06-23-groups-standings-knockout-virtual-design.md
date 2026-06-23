# Spec: Classificação de Grupos + Mata-mata Virtual

**Data:** 2026-06-23  
**Branch:** feat/live-ranking-race-animation  
**Escopo:** Fase de Grupos (standings) + Mata-mata (confrontos virtuais + unlock temporal)

---

## Contexto

O sistema já possui `/groups` (lista de grupos sem tabela de classificação) e `/knockout` (navegação linear por fase). Este spec cobre três melhorias conectadas:

1. **Standings dos grupos** — tabela de classificação real com critérios oficiais FIFA 2026
2. **Confrontos virtuais no mata-mata** — R32 gerado em memória a partir dos standings atuais; fases R16+ com labels de slot
3. **Gatilho de liberação OR** — palpites do mata-mata liberados quando `isGroupStageComplete() OR now >= 27/06 23h BRT`

---

## Feature 1 — Classificação dos Grupos

### Critérios de desempate FIFA 2026 (em ordem)

1. Pontos (V=3, E=1, D=0)
2. Saldo de gols (GP − GC)
3. Gols marcados (GP)
4. Pontos no confronto direto entre empatados
5. Saldo de gols no confronto direto
6. Gols marcados no confronto direto
7. Fair play (não implementado — schema não armazena cartões; aplica critério 8)
8. Estabilidade de ordenação (mantém ordem original como desempate final)

### Tipos

```ts
// src/lib/group.ts
export interface TeamStanding {
  teamId: string
  name: string
  countryCode: string
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  goalDiff: number
  points: number
  position: number // 1–4 após ordenação
}
```

### Função pura

```ts
// src/lib/group.ts
export function computeGroupStandings(
  teams: Array<{ id: string; name: string; countryCode: string }>,
  matches: Array<{
    homeTeamId: string; awayTeamId: string;
    homeScore: number | null; awayScore: number | null;
    status: MatchStatus;
  }>,
): TeamStanding[]
```

- Considera apenas partidas com `homeScore != null && awayScore != null`
- Partidas não disputadas contribuem com zero para todos os stats
- Aplica os 8 critérios em sequência

### Alterações nos serviços

`src/server/services/groups.ts` — `getGroupsWithMatches()` inclui agora os matches com `homeTeamId`/`awayTeamId` e scores para alimentar `computeGroupStandings()`. Retorna:

```ts
{
  letter: string
  standings: TeamStanding[]   // ← novo
  matches: MatchWithBet[]
}
```

### Alterações no componente

`src/components/groups/groups-grid.tsx` — adiciona tabela de standings acima da lista de times dentro de cada card de grupo:

```
┌──────────────────────────────────────────┐
│  GRUPO A                   [✏ Palpitar]  │
├──────────────────────────────────────────┤
│  #  País           P  J  V  E  D  SG  GP │
│  1  México         6  2  2  0  0  +4   4 │
│  2  Coreia Sul     3  2  1  0  1  +1   2 │
│  3  Rep. Tcheca    1  2  0  1  1  -1   1 │
│  4  África do Sul  1  2  0  1  1  -4   1 │
├──────────────────────────────────────────┤
│  3 jogos  •  2 palpitados  🔒            │
└──────────────────────────────────────────┘
```

Times com zero jogos aparecem zerados, ordenados por nome.

---

## Feature 2 — Confrontos Virtuais no Mata-mata

### Arquitetura

```
computeGroupStandings()
        ↓
resolveR32Bracket(standings)
        ↓
virtual MatchWithBet[] para R32 (times reais quando possível)
        +
virtual MatchWithBet[] para R16/QF/SF/FINAL com labels
        ↓
PhaseView (sem mudança de interface)
```

### `src/lib/bracket.ts` — nova

Define a estrutura fixa do R32 da Copa 2026:

```ts
type BracketSlot =
  | { kind: "group_1"; group: string; label: string }
  | { kind: "group_2"; group: string; label: string }
  | { kind: "best_3"; groups: string[]; label: string }
  | { kind: "winner_r32"; n: number; label: string }
  | { kind: "winner_r16"; n: number; label: string }
  | { kind: "winner_qf"; n: number; label: string }
  | { kind: "loser_sf"; n: number; label: string }

interface BracketMatch {
  slotLabel: string
  home: BracketSlot
  away: BracketSlot
}

export const FIFA_2026_R32: BracketMatch[]   // 16 confrontos
export const FIFA_2026_R16: BracketMatch[]   // 8 confrontos (winner_r32 N vs M)
export const FIFA_2026_QF: BracketMatch[]    // 4 confrontos
export const FIFA_2026_SF: BracketMatch[]    // 2 confrontos
export const FIFA_2026_THIRD: BracketMatch[] // 1 confronto (loser_sf)
export const FIFA_2026_FINAL: BracketMatch[] // 1 confronto

export function resolveSlot(
  slot: BracketSlot,
  standings: Map<string, TeamStanding[]>,
): { team: { name: string; countryCode: string } | null; label: string }
```

Regras de resolução:

| Slot | Lógica |
|---|---|
| `group_1` | `standings.get(group)?.[0]` |
| `group_2` | `standings.get(group)?.[1]` |
| `best_3` | Melhor 3° colocado entre os grupos listados (maior pontos → saldo → GP) |
| `winner_r32` / `winner_r16` / `winner_qf` / `loser_sf` | Não resolvível em memória → retorna `null` (exibe label) |

### Geração server-side: `getKnockoutMatchesWithVirtual()`

```ts
// src/server/services/matches.ts
export async function getKnockoutMatchesWithVirtual(opts: {
  userId: string
  poolId: string
}): Promise<MatchWithBet[]>
```

Lógica interna:
```
1. Busca todos os matches do BD (todas as fases)
2. Separa matches por stage
3. Computa standings de todos os grupos (usando matches GROUP do BD)
4. Para cada fase eliminatória (R32, R16, QF, SF, THIRD_PLACE, FINAL):
   - Se existem matches reais no BD para essa fase → usa os reais
   - Se não existem → gera virtual a partir do bracket fixo + standings
5. Retorna array unificado: reais + virtuais
```

### Tipo estendido `MatchWithBet`

```ts
// src/server/services/matches.ts
export type MatchWithBet = BaseMatch & {
  bet: Bet | null
  // Campos opcionais para confrontos virtuais:
  isVirtual?: true
  homeLabel?: string   // "1°E", "3°ABCDF", "Venc. R32-1"
  awayLabel?: string
  slotLabel?: string   // "segunda fase 1", "oitavas 1"
}
```

Para partidas virtuais: `lockAt` é definido como `KNOCKOUT_UNLOCK_DATE` (sempre travado até a liberação).

### Componente `VirtualMatchCard`

`src/components/knockout/virtual-match-card.tsx` — novo componente:

- Mostra `slotLabel` como cabeçalho do card
- Exibe bandeira + nome quando `team != null`; escudo + label quando `team == null`
- Nunca exibe input de palpite (sempre bloqueado visualmente)
- Estilo consistente com `MatchCard` existente

O `PhaseView` checa `match.isVirtual` e renderiza `VirtualMatchCard` em vez de `MatchCard`.

### Schema: migration leve

```sql
-- Campos opcionais para quando API retorna homeTeam.id = null
ALTER TABLE "Match" ADD COLUMN "homeTeamLabel" TEXT;
ALTER TABLE "Match" ADD COLUMN "awayTeamLabel" TEXT;
```

O sync da API preenche esses campos com o label do bracket quando `homeTeam.id == null`; limpa quando o time for definido. As partidas virtuais geradas em memória não usam esses campos (não persistem).

### Comportamento de exibição por estado

| Estado | R32 exibe |
|---|---|
| Grupos em andamento | Times resolvidos via standings atuais (bandeira) ou shield+label se grupo não jogou |
| Grupos finalizados, API sem times | Times resolvidos via standings finais |
| API sincronizou times reais | Matches reais do BD (não virtual) |

---

## Feature 3 — Gatilho de Liberação OR

### Constante

```ts
// src/lib/constants.ts
/** Liberação dos palpites do mata-mata: 27/06/2026 às 23h BRT (02:00 UTC do dia 28). */
export const KNOCKOUT_UNLOCK_DATE = new Date("2026-06-28T02:00:00.000Z");
```

### Nova função

```ts
// src/server/services/matches.ts
export async function isKnockoutUnlocked(): Promise<boolean> {
  if (new Date() >= KNOCKOUT_UNLOCK_DATE) return true;
  return isGroupStageComplete();
}
```

`isGroupStageComplete()` permanece intacta.

### Mudança na página

```diff
// src/app/(app)/knockout/page.tsx
- const groupComplete = await isGroupStageComplete();
+ const groupComplete = await isKnockoutUnlocked();
```

### Tabela de comportamento

| Situação | Resultado |
|---|---|
| Antes de 27/06 23h BRT, grupos incompletos | `false` — travado |
| Grupos terminam antes de 27/06 23h | `false` — aguarda a data |
| Chega 27/06 23h, grupos ainda incompletos | `true` — libera pela data |
| Grupos terminam após 27/06 23h | `true` — libera pelos grupos |

---

## Arquivos afetados

| Arquivo | Tipo de mudança |
|---|---|
| `src/lib/group.ts` | Adiciona `computeGroupStandings()` e `TeamStanding` |
| `src/lib/bracket.ts` | Novo — bracket FIFA 2026 + `resolveSlot()` |
| `src/lib/constants.ts` | Adiciona `KNOCKOUT_UNLOCK_DATE` |
| `src/server/services/groups.ts` | `getGroupsWithMatches()` retorna `standings` |
| `src/server/services/matches.ts` | Adiciona `isKnockoutUnlocked()`, `getKnockoutMatchesWithVirtual()`, estende `MatchWithBet` |
| `src/components/groups/groups-grid.tsx` | Adiciona tabela de standings |
| `src/components/knockout/virtual-match-card.tsx` | Novo componente |
| `src/components/knockout/phase-view.tsx` | Renderiza `VirtualMatchCard` quando `isVirtual` |
| `src/app/(app)/knockout/page.tsx` | Troca `isGroupStageComplete` por `isKnockoutUnlocked`; troca `getAllMatchesWithBets` por `getKnockoutMatchesWithVirtual` |
| `prisma/schema.prisma` | Adiciona `homeTeamLabel` e `awayTeamLabel` em `Match` |
| `prisma/migrations/...` | Migration para os dois campos opcionais |

---

## Fora de escopo

- Bracket visual estilo copa (chaveamento gráfico) — adiado
- Fair play (critério 7) — schema não armazena cartões
- Sync automático de matches do mata-mata via API (passos futuros do sync script)
- Resolução in-memory de R16/QF/SF a partir de R32 virtual (depende de R32 ter resultado)
