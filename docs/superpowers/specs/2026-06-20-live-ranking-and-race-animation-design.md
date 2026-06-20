# Ranking ao vivo + corrida fluida — design

Data: 2026-06-20
Autor: Jouberth (via par de programação)

## Contexto

- App Next.js 15 (App Router) + React 19, dados via Server Components com
  `export const dynamic = "force-dynamic"`. O componente [`AutoRefresh`](../../../src/components/auto-refresh.tsx)
  chama `router.refresh()` a cada 20s — é o nosso loop de "tempo quase real".
- O cron da ESPN ([`live-score.ts`](../../../src/server/services/live-score.ts)) escreve
  `homeScore`/`awayScore` e `status: LIVE` na linha `Match` durante o jogo, mas
  **não** mexe em `Bet.pointsEarned` nem em `Match.scored`. A pontuação definitiva
  e o ranking só mudam quando o cron de encerramento marca `FINISHED` + `scored`.
- A tela de Confronto já calcula pontos provisórios no client de forma PURA via
  [`pointsForResult`](../../../src/lib/bet-result.ts) e
  [`withProvisionalPoints`](../../../src/lib/matchup.ts).
- O ranking ([`ranking.ts`](../../../src/server/services/ranking.ts)) ignora tudo
  isso: lê só `Membership.totalPoints` (denormalizado).
- A corrida ([`race-track.tsx`](../../../src/components/pool/race-track.tsx)) ordena
  as raias pelo **total final**, então elas nunca reordenam verticalmente; o único
  movimento é `transition-[left]` — daí a sensação "seca".

## Tarefa 1 — Ranking ao vivo (DTO transiente no servidor)

**Estratégia aprovada:** computar o overlay ao vivo no servidor, num DTO
transiente. O banco continua sendo a fonte da verdade só para `FINISHED`. Zero
writes de pontuação parcial. A reatividade vem do poll de 20s já existente.

### `getRanking` (servidor)

Estende `RankingRow`:

```ts
export interface RankingRow {
  position: number;       // posição já considerando livePoints
  userId: string;
  name: string | null;
  image: string | null;
  consolidatedPoints: number; // = Membership.totalPoints (fonte da verdade)
  livePoints: number;         // soma provisória dos jogos LIVE (0 se nada ao vivo)
  totalPoints: number;        // consolidatedPoints + livePoints
  exactHits: number;          // só jogos FINISHED+scored (inalterado)
  hits: number;               // só jogos FINISHED+scored (inalterado)
  misses: number;             // só jogos FINISHED+scored (inalterado)
  isLive: boolean;            // true se livePoints > 0 (tem ponto provisório em jogo ao vivo)
}
```

Lógica:

1. Lê memberships com `totalPoints` (consolidado), como hoje.
2. Carrega a `ScoringRule` do bolão (mesmo fallback de `matchups.ts`).
3. Busca jogos `status: LIVE` do torneio com `homeScore`/`awayScore != null` e os
   bets daquele bolão (`select: userId, homeGuess, awayGuess`).
4. Para cada bet de jogo LIVE: `classifyBet(guess, {home, away, finished: true})`
   (tratamos o placar ao vivo como "final provisório") → `pointsForResult(result, rule)`.
   Acumula por `userId` em `livePoints`.
5. `totalPoints = consolidatedPoints + livePoints`. Ordena por `totalPoints` desc
   (desempate estável: `consolidatedPoints` desc, depois nome) e atribui `position`.

`hits`/`misses`/`exactHits` continuam contando **só** `FINISHED+scored` — jogo ao
vivo não tem "erro" definitivo.

### `RankingTable` (client)

- Mostra `totalPoints`. Quando `isLive`, exibe um badge pulsante `+{livePoints} ao
  vivo` e um leve realce na linha.
- Reordenação animada: envolver as linhas com `motion` e `layout` para que, quando
  o poll de 20s trouxer nova ordem, as linhas deslizem para a nova posição em vez
  de "pular". `LayoutGroup`/`AnimatePresence` para entradas/saídas suaves.

### Por que servidor e não client-store

A pontuação provisória depende de placar ao vivo (já no banco) + bets + regra —
tudo no servidor, já no poll. Calcular no client duplicaria a lógica de pontuação
e exigiria expor todos os bets ao vivo. O DTO mantém uma única fonte de cálculo.

## Tarefa 2 — Corrida fluida + filtro "Jogo"

### Filtro "Jogo"

`Mode = "round" | "day" | "game"`. Novo builder `buildGameCheckpoints(matches)`:
um checkpoint por jogo já pontuado, em ordem cronológica, `cutoff = i`, label
curto do confronto (ex.: `TUR × PAR` por código ISO, ou nº do jogo se faltar
nome). O `ModeToggle` ganha o botão "Jogo" (ícone `Swords`/`Flag`).

Para o label do jogo a corrida precisa dos nomes/códigos dos times por match —
estender `RaceMatch` com `homeCode`/`awayCode` (já temos os times no `getRaceData`;
adicionar ao `select`).

### Animação fluida (framer-motion / `motion`)

- Adicionar dependência `motion` (sucessor do framer-motion, compatível com React 19).
- **Ultrapassagens reais:** ordenar as raias por pontos **do checkpoint atual**
  (desempate estável por `userId`) em vez do total final. Assim os avatares sobem e
  descem.
- Cada raia vira um `motion.div` com `layout` — a reordenação vertical é
  interpolada automaticamente pelo FLIP do motion.
- O movimento horizontal passa de `left` (layout) para `transform: translateX` via
  `motion` animando `x`/percentual, com `transition` tipo `spring` (suave, sem
  "pulo de frame").
- Respeitar `prefers-reduced-motion` (motion já tem `useReducedMotion`): desliga as
  transições para quem pede menos movimento.

## Componentização

- `getRanking` ganha o cálculo do overlay; manter a função PURA de soma
  (`sumLivePoints`) em `lib/` se ficar testável isolada (espelha o padrão de
  `live-score.ts`/`matchup.ts`).
- `race-track.tsx`: extrair `buildGameCheckpoints` junto dos outros builders;
  isolar a raia animada num subcomponente `Lane` já existente (só troca o wrapper
  por `motion`).

## Testes

- `ranking` (novo teste): dado bets em jogo LIVE + regra, `livePoints` e ordem
  saem corretos; jogo FINISHED não entra em `livePoints` (já está no consolidado);
  `hits/misses` ignoram LIVE.
- `buildGameCheckpoints`: um checkpoint por jogo, ordem e cutoffs corretos.
- Reaproveitar `bet-result.test`/`matchup.test` existentes para a lógica pura.

## Fora de escopo (YAGNI)

- Websockets / store no client / SWR dedicado.
- Persistir pontuação parcial no banco.
- Animar números (count-up) — só posição/ordem por enquanto.
```
