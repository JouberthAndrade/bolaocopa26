# Bots Claudinho & Gepeto — palpites de IA no Confronto

**Data:** 2026-06-10
**Status:** Aprovado

## Objetivo

Criar dois usuários "bots" — **Claudinho** e **Gepeto** — cujos palpites são
gerados por IA. A cada rodada comparamos o desempenho humano vs. o da máquina
("será que vamos perder pra máquina?"). Os palpites dos bots aparecem na aba
**Confronto** de todos os bolões, com um layout diferenciado, e os bots competem
no **Ranking** como membros normais.

## Decisões (brainstorming)

- **Escopo:** bots competem no Ranking (bets pontuadas) **e** aparecem no Confronto.
- **Marcação:** campo `isBot` (+ `botKind`) no `User`, via migration.
- **Formato do script:** TS/Prisma reexecutável (`scripts/seed-bots.ts`), no estilo
  de `scripts/sync-matches.ts`.
- **Layout:** seção fixa "🤖 Inteligência Artificial" no topo do modal de Confronto,
  com card especial por bot; humanos listados abaixo.

## Contexto da arquitetura existente

- A aba **Confronto** (`src/app/(app)/b/[slug]/page.tsx`) lista jogos `FINISHED`
  via `getFinishedMatchups`. Ao abrir um jogo, o modal chama a server action
  `loadMatchupDetail` → `getMatchupDetail`, que monta as linhas a partir das
  **memberships do bolão + os `Bet` daquele jogo** (`buildMatchupRows`).
- **A regra de tempo já é garantida**: `getMatchupDetail` só revela palpites após
  `match.lockAt` e só para jogos finalizados. Logo, bets de bot pré-carregadas
  ficam ocultas até o jogo terminar — sem tratamento extra.
- **Scoring** (`scoreFinishedMatches`) percorre `Bet.pointsEarned` e é idempotente
  via `Match.scored`. `recalcPoolStandings` soma `pointsEarned` por usuário para o
  `Membership.totalPoints` (ranking). Como os bots serão membros, suas bets entram
  naturalmente no ranking.
- **Cuidado de idempotência:** se um jogo já está `scored=true`, inserir uma bet de
  bot depois **não** a pontua automaticamente. O script precisa re-pontuar os jogos
  finalizados afetados.

## Componentes

### 1. Schema — `prisma/schema.prisma`

Adicionar ao model `User`:

```prisma
isBot   Boolean  @default(false)
botKind BotKind?
```

Novo enum:

```prisma
enum BotKind {
  CLAUDINHO
  GEPETO
}
```

Aplicado via `npx prisma db push` (o projeto não usa histórico de migrations —
não há pasta `prisma/migrations`). Colunas aditivas, nullable/com default, sem
perda de dados. Humanos não são afetados (`isBot=false`, `botKind=null`).

### 2. Script — `scripts/seed-bots.ts` (`npm run seed:bots`)

Idempotente e reexecutável a cada rodada. Passos:

1. **Upsert dos dois bots** (`claudinho@bot.bolao`, `gepeto@bot.bolao`), `isBot=true`,
   `botKind` correspondente, sem `passwordHash` (não logam). Avatar opcional.
2. **Entrar em todos os bolões:** para cada `Pool`, upsert de `Membership`
   (role `MEMBER`) para cada bot.
3. **Carregar JSON** de `docs/claudinho.json` e `docs/gepeto.json`. Suportar as duas
   formas: Claudinho é `{ matches: [...] }`; Gepeto é um array puro.
4. **Casar fixtures por código ISO da seleção** (não por `round`/`date`, pouco
   confiáveis em gepeto.json). O DB guarda nomes em **português** (`Alemanha`,
   `Inglaterra`), então o casamento por nome seria frágil; em vez disso, mapeamos
   cada nome em inglês do JSON → código ISO (`src/lib/team-name.ts` `teamCode`) e
   casamos contra `Team.countryCode` do DB (estável, imune a acento/idioma). Casa
   em **qualquer orientação**; atribui `homeGuess/awayGuess` conforme o home/away
   real no DB (se DB.home == team1 → `homeGuess=score_team1`, senão inverter).
5. **Upsert de `Bet`** por (bot, pool, match), garantido por `@@unique([userId,
   poolId, matchId])`. Reexecuções atualizam o palpite sem duplicar.
6. **Re-pontuar finalizados:** após inserir as bets, setar `scored=false` nos jogos
   `FINISHED` afetados e chamar `scoreFinishedMatches()` (reuso do caminho real de
   scoring), que recalcula `pointsEarned` e `totalPoints` — incluindo os bots no
   ranking.
7. **Relatório:** logar contagem de bets casadas/atualizadas por bot e listar
   fixtures do JSON sem `Match` correspondente no DB.
8. **Não incluir nos valores**: Os bots não devem ser incluídos como menbros do bolão, ou seja, se o bolão tem 5 jogadores e vale 100 reias, o total fica 500 e não 700.

**Dependência de dados:** o script só anexa bets a fixtures que **existem no DB**
(via `npm run sync:matches`). Fixtures hipotéticos ainda não sincronizados são
ignorados e reportados — não é erro.

### 3. Diferenciação na UI — modal de Confronto

- `src/server/services/matchups.ts`: incluir `isBot` e `botKind` no `select` das
  memberships; propagar por `MatchupMember`/`MatchupRow` (`src/lib/matchup.ts`).
- Separar as linhas em **bots** e **humanos** (bots no topo, humanos ordenados por
  pontos pela lógica atual de `buildMatchupRows`).
- `src/components/pool/confronto-list.tsx`: renderizar bloco fixo
  **"🤖 Inteligência Artificial"** no topo do modal, com card distinto por bot
  (Claudinho = gradiente roxo, Gepeto = gradiente verde, ícone de robô, badge "IA"),
  reusando a lógica de placar e `ResultBadge`. Lista de humanos abaixo, inalterada.

## Fora de escopo (YAGNI)

- Estilo especial para bots na aba **Ranking** (aparecem como membros comuns).
- Palpites de mata-mata / `ChampionBet` para bots (JSON cobre só fase de grupos).
- UI de administração para gerenciar bots.

## Critérios de aceite

- `npm run seed:bots` cria os dois bots, os coloca em todos os bolões e insere os
  palpites casáveis; reexecução não duplica nada.
- No Confronto de um jogo finalizado, os palpites dos bots aparecem numa seção
  destacada no topo, com layout distinto por bot, e os humanos abaixo.
- Antes de um jogo terminar, os palpites dos bots permanecem ocultos (regra de
  `lockAt`/`FINISHED` herdada).
- Os bots somam pontos e figuram no Ranking.
