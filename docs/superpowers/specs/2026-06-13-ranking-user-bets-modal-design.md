# Ranking — Modal de Extrato por Participante

**Data:** 2026-06-13
**Status:** Aprovado

## Contexto

A tela de Ranking (`/b/[slug]?tab=ranking`) exibe as linhas de cada participante com pontos, acertos e erros. A melhoria adiciona interatividade: ao clicar em qualquer linha, um modal abre mostrando os jogos finalizados em que aquele participante palpitou — análogo ao `/extrato` pessoal, mas acessível para qualquer membro do bolão, seguindo a mesma regra de visibilidade já aplicada na aba Confronto.

## Abordagem

**Opção A — Server Action + RankingTable como Client Component.**

`RankingTable` recebe `poolId` como novo prop, vira `"use client"`, mantém estado local de usuário selecionado e dados carregados, e usa a Server Action para buscar os palpites sob demanda.

## Arquitetura

### 1. Server Action — `getUserBetsInPool`

**Arquivo:** `src/server/actions/bets.ts` (nova função exportada)

```ts
export async function getUserBetsInPool(
  targetUserId: string,
  poolId: string,
): Promise<ActionResult<UserBetRow[]>>
```

**Lógica:**
1. `requireUserId()` — garante sessão ativa.
2. Valida que o caller é membro do bolão (`requireMembership`).
3. Busca `Bet` onde `userId = targetUserId`, `poolId = poolId`, `match.status = "FINISHED"`.
4. Inclui: `homeTeam { name, countryCode }`, `awayTeam { name, countryCode }`, `homeScore`, `awayScore`, `homeGuess`, `awayGuess`, `pointsEarned`, `kickoffAt`.
5. Ordena por `kickoffAt desc` (mais recentes primeiro).
6. Retorna `{ ok: true, data: UserBetRow[] }` ou `{ ok: false, error: string }`.

**Tipo `UserBetRow`:**
```ts
interface UserBetRow {
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
```

### 2. Componente — `RankingTable`

**Arquivo:** `src/components/pool/ranking-table.tsx`

**Mudanças:**
- Adiciona `"use client"` no topo.
- Novo prop: `poolId: string`.
- Estado interno:
  - `selectedUser: { userId: string; name: string; image: string | null } | null`
  - `bets: UserBetRow[] | null`
  - `loading: boolean`
  - `error: string | null`
- Cada linha recebe `onClick` que: seta `selectedUser`, limpa bets anteriores, seta `loading = true`, chama `getUserBetsInPool`, atualiza estado.
- Estilo das linhas: `cursor-pointer hover:bg-secondary/40 transition-colors` (adicionado ao `className` existente).

### 3. Modal de extrato

Usa o `Dialog` existente (`src/components/ui/dialog.tsx`).

**Título:** avatar + nome do participante selecionado.

**Corpo — estados possíveis:**
- `loading = true`: spinner centralizado.
- `error`: mensagem de erro em vermelho.
- `bets.length === 0`: "Nenhum jogo finalizado com palpite ainda."
- Lista de jogos: uma linha por `UserBetRow`.

**Layout de cada linha de jogo:**
```
<Flag code={homeCode} /> HomeName  homeGuess × awayGuess  AwayName <Flag code={awayCode} />
                          [resultado real: homeScore × awayScore]
                          X pts  (colorido: verde se > 0, cinza se 0)
```

**Rodapé do modal:**
- Total de pontos somados dos jogos exibidos.
- Contagem: N acerto(s) · M erro(s).

### 4. Ajuste na página do bolão

**Arquivo:** `src/app/(app)/b/[slug]/page.tsx`

`RankingSection` passa `poolId` para `RankingTable`:
```tsx
<RankingTable rows={rows} currentUserId={userId} poolId={poolId} />
```

## Edge Cases

| Caso | Comportamento |
|------|---------------|
| Participante sem palpites fechados | Mensagem vazia no modal |
| Erro na action | Exibe erro no modal, não fecha |
| Clique em outro usuário enquanto modal aberto | Fecha o anterior e abre novo (sobrescreve state) |
| Fechar modal | Backdrop, botão X ou Esc — já implementado no Dialog |
| Visibilidade | Mesma regra do Confronto — membros do bolão veem palpites fechados de todos |

## Arquivos Modificados

| Arquivo | Tipo de mudança |
|---------|-----------------|
| `src/server/actions/bets.ts` | Nova função `getUserBetsInPool` + tipo `UserBetRow` |
| `src/components/pool/ranking-table.tsx` | "use client", prop `poolId`, estado, Dialog, onClick |
| `src/app/(app)/b/[slug]/page.tsx` | Passa `poolId` para `RankingTable` |

## Arquivos Não Modificados

- `src/components/ui/dialog.tsx` — reutilizado sem alteração
- `src/components/flag.tsx` — reutilizado sem alteração
- `src/server/services/ranking.ts` — sem alteração
