# Mata-mata: escolha de quem avança nos pênaltis + correção do salvamento

Data: 2026-06-27
Branch base: `feat/live-ranking-race-animation`

## Resumo

Duas entregas no mata-mata:

1. **Correção (bug):** palpites do mata-mata não salvam ("Erro ao salvar").
2. **Melhoria (feature):** quando o usuário palpita empate num jogo de mata-mata,
   ele deve escolher quem avança nos pênaltis. A escolha é **obrigatória** para
   salvar e **vale 1 ponto de bônus** quando o jogo real é decidido nos pênaltis
   e o usuário acerta quem passou.

---

## Parte 1 — Correção do salvamento

### Causa-raiz

O portão (gate) de liberação dos palpites do mata-mata está **inconsistente
entre UI e servidor**:

- A página do mata-mata decide o que é editável com `isKnockoutUnlocked()` —
  libera quando **a fase de grupos terminou OU** a data passou de 27/06 23h BRT
  (`src/server/services/matches.ts:100`).
- A action de salvar `upsertBet` ainda usa o gate **mais restrito**
  `isGroupStageComplete()` — exige que **todos** os jogos de grupo estejam
  `FINISHED` (`src/server/actions/bets.ts:36`).

Quando o gate por data libera a UI (ou algum jogo de grupo não está marcado como
`FINISHED` no banco), o card mostra os inputs como editáveis, o usuário digita o
placar, e o servidor rejeita → **"Erro ao salvar"**. O gate da action nunca foi
atualizado quando a liberação por "OU data" foi adicionada (a spec original
mexeu só na *página*, não na *action*).

### Correção

Em `upsertBet`, trocar `isGroupStageComplete()` por `isKnockoutUnlocked()`, de
modo que o servidor use o mesmo critério da UI.

```diff
- import { isGroupStageComplete } from "@/server/services/matches";
+ import { isKnockoutUnlocked } from "@/server/services/matches";
...
- if (match.stage !== "GROUP" && !(await isGroupStageComplete())) {
+ if (match.stage !== "GROUP" && !(await isKnockoutUnlocked())) {
    return { ok: false, error: "Os palpites das fases finais abrem após a fase de grupos" };
  }
```

### Teste de regressão

Teste do `upsertBet` (ou de uma função pura extraída do gate) cobrindo:
jogo de mata-mata `SCHEDULED`, fase de grupos **não** completa, mas após
`KNOCKOUT_UNLOCK_DATE` → palpite **salva** (antes da correção, falhava).

---

## Parte 2 — Escolha de quem avança nos pênaltis

### Decisões do produto

| Decisão | Escolha |
|---|---|
| Bônus por acertar quem avança | **Sim**, quando o jogo real vai aos pênaltis |
| Valor do bônus | **1 ponto** (constante, não configurável por bolão) |
| Escolha obrigatória no empate | **Sim**, empate de mata-mata só salva com a escolha |
| Onde aparece na UI | **Só no card do jogo** (fluxo de autosave atual) |

### Modelo de dados

```prisma
enum Advance {
  HOME
  AWAY
}

model Bet {
  // ...
  advances Advance?  // pick do usuário; preenchido só em palpite de empate no mata-mata
}

model Match {
  // ...
  penaltyWinner Advance?  // vencedor real do shootout; != null somente quando decidido nos pênaltis
}
```

Constante de pontuação (não vai para `ScoringRule`):

```ts
// src/lib/constants.ts
export const POINTS_PENALTY_ADVANCE = 1;
```

Migração Prisma **aditiva** (enum + duas colunas nullable). Sem mudança em
`ScoringRule`, sem mudança no formulário de criação de bolão.

### UX (card do jogo — `match-card.tsx`)

O seletor aparece **somente** quando:
`match.stage !== "GROUP"` **e** `home !== ""` **e** `away !== ""` **e** `home === away`.

- Rótulo: **"Quem avança nos pênaltis?"**
- Dois botões com bandeira + nome (mandante / visitante); um fica selecionado.
- O estado `advances` (`"HOME" | "AWAY" | undefined`) entra no payload do `upsertBet`.

Regras de salvamento:

- **Empate sem escolha** → não dispara o autosave; mostra aviso
  "Escolha quem avança nos pênaltis" (em vez de tentar salvar e dar erro).
- Mudar de empate para placar não-empate **limpa** `advances` no payload.
- Mudar o placar para empate volta a exigir a escolha.

Exibição após o lock / fim de jogo:

- `Meu palpite: 1 × 1 · 🇧🇷 nos pênaltis` (bandeira do time escolhido).
- Badge de resultado: quando o bônus de pênaltis foi ganho, soma visível
  (ex.: "Acertou o empate + quem passou · +3 pts").

### Validação no servidor (`upsertBet`)

`betSchema` ganha campo opcional `advances: z.enum(["HOME","AWAY"]).optional()`.

Regra de negócio no `upsertBet` (após resolver o `match`):

- Se `match.stage !== "GROUP"` **e** `homeGuess === awayGuess` **e** `advances`
  ausente → `{ ok: false, error: "Escolha quem avança nos pênaltis" }`.
- Se **não** for empate de mata-mata → grava `advances: null` (ignora qualquer
  valor enviado), evitando lixo de estado.
- Caso contrário, persiste `advances`.

### Pontuação (`computeBetPoints` + `scoreFinishedMatches`)

Base inalterada: acertar o empate de 90/120 min continua valendo
`pointsCorrectDraw`. O bônus é **somado** por cima:

`computeBetPoints` ganha parâmetros opcionais:

```ts
computeBetPoints(
  rule,
  guess: { home, away },
  actual: { home, away },
  opts?: { betAdvances?: Advance | null; penaltyWinner?: Advance | null; penaltyBonus?: number },
): number
```

Lógica adicional (após o cálculo base):

- Se `opts.penaltyWinner != null` (jogo foi aos pênaltis)
  **e** `guess.home === guess.away` (palpite foi empate)
  **e** `opts.betAdvances === opts.penaltyWinner`
  → soma `opts.penaltyBonus` (= `POINTS_PENALTY_ADVANCE`).

`scoreFinishedMatches` passa `bet.advances`, `match.penaltyWinner` e a constante.
Função permanece pura e testável.

### Origem do vencedor real (`penaltyWinner`)

**Provedor (sync):** `ProviderMatch` ganha `penaltyWinner: Advance | null`,
derivado de `score.winner` + `score.duration`:

- `duration === "PENALTY_SHOOTOUT"` → `penaltyWinner = HOME` se
  `winner === "HOME_TEAM"`, `AWAY` se `"AWAY_TEAM"`; caso contrário `null`.
- `sync.ts` persiste `Match.penaltyWinner` junto com o resultado.

> **A verificar na implementação:** como a Football-Data v4 reporta
> `score.fullTime` em jogos de shootout (se já inclui os pênaltis ou mantém o
> placar do tempo normal/prorrogação). `homeScore/awayScore` devem guardar o
> placar **empatado** do tempo normal/prorrogação para a lógica de empate
> continuar válida; os pênaltis ficam só em `penaltyWinner`. Confirmar contra
> dado real da API antes de fechar o sync.

**Admin (`set-result`):** `manualResultSchema` ganha
`penaltyWinner: z.enum(["HOME","AWAY"]).optional()`; `applyManualResults`
persiste em `Match.penaltyWinner`. Permite lançar manualmente um shootout.

### Propagação do pick para a UI

`getMatchesWithBets`, `getAllMatchesWithBets`, `getKnockoutMatchesWithVirtual` e
`getUpcomingMatchesWithBets` passam a selecionar `advances` no `bet` e
`penaltyWinner` no match; o tipo `MatchWithBet.bet` ganha `advances: Advance | null`
e `MatchWithBet` ganha `penaltyWinner: Advance | null`.

---

## Fora de escopo

- Grupos: empate é resultado válido — sem seletor.
- Progressão de chaveamento por palpite do usuário (não existe hoje; os
  confrontos virtuais resolvem a partir dos resultados/standings reais).
- Tornar o bônus configurável por bolão (decidido: constante fixa de 1 ponto).
- Exibir a escolha de outros participantes na tela de confronto.

## Arquivos afetados (visão geral)

| Arquivo | Mudança |
|---|---|
| `prisma/schema.prisma` + nova migração | enum `Advance`, `Bet.advances`, `Match.penaltyWinner` |
| `src/lib/constants.ts` | `POINTS_PENALTY_ADVANCE = 1` |
| `src/lib/validations.ts` | `advances` opcional no `betSchema` |
| `src/server/actions/bets.ts` | gate `isKnockoutUnlocked`; validação + persistência de `advances` |
| `src/server/services/scoring.ts` | bônus de pênaltis em `computeBetPoints` + `scoreFinishedMatches` |
| `src/server/services/matches.ts` | seleciona/expõe `advances` e `penaltyWinner` |
| `src/server/providers/football/{types,football-data}.ts` | `penaltyWinner` no `ProviderMatch` |
| `src/server/services/sync.ts` | persiste `penaltyWinner` |
| `src/lib/manual-result.ts` + `src/server/services/manual-result.ts` | `penaltyWinner` opcional no lançamento manual |
| `src/components/match/match-card.tsx` | seletor de avanço + exibição |
| Testes | regressão do gate; `computeBetPoints` com bônus; validação do empate obrigatório |
