# Home mobile-first + navegação responsiva

Data: 2026-06-30

## Objetivo

Tornar a home mobile-first e enxugar a navegação. O `BottomNav` atual tem 8 itens
(apertado no mobile). Reduzir para **4 menus primários** e mover os secundários para
um menu no avatar.

- **Primários** (sempre visíveis na navegação): Mata-Mata (`/knockout`), Confronto
  (`/confronto`), Ranking (`/b`), Grupos (`/groups`).
- **Secundários** (no dropdown do avatar): Jogos (`/jogos`), Agenda (`/calendar`),
  Bolões (`/pools`), Perfil (`/profile`), Sair.

## Decisões (do brainstorming)

1. **Home (`/`)** vira um **hub/painel do bolão** (não mais a tela de Jogos).
2. **Secundários** ficam num **dropdown no avatar** (header).
3. **Responsivo:** barra de abas fixa embaixo no mobile; nav horizontal no header no
   desktop (`≥ md`).
4. **Agenda** vai para o menu secundário.

## Arquitetura de navegação

- `nav-items.ts`: fonte única dos itens primários (`href`, `label`, `icon`).
- `PrimaryNav` (client, usa `usePathname` p/ estado ativo) com `variant`:
  - `variant="bottom"`: barra fixa inferior, `md:hidden`.
  - `variant="top"`: linha horizontal no header, `hidden md:flex`.
- `BottomNav` passa a renderizar `PrimaryNav variant="bottom"` com os 4 itens.
- `AppHeader` (server): logo + `PrimaryNav variant="top"` + `UserMenu`.
- `UserMenu` (client): avatar como botão; abre menu (click-outside, sem dep nova) com
  os secundários + Sair. `signOut` via server action importada (`"use server"`).
- `layout.tsx`: `main` reduz folga inferior no desktop (`pb-24 md:pb-8`), já que a
  barra inferior some em `md`.

Sem novas dependências (projeto não usa Radix; `dialog` é custom).

## Home = Hub do bolão (`/`)

Coluna única no mobile; grid no desktop. De cima para baixo:

1. `PoolSelector` + título do bolão (reaproveita o existente).
2. **Card "Sua posição":** posição + pontos do usuário no bolão + mini top-3
   (via `getRanking(poolId)`, localizando a linha do usuário).
3. **Grid 2×2 de atalhos** grandes/tocáveis para os 4 primários (ícone + label).
4. **Próximos jogos** (`getUpcomingMatchesWithBets`, ~3-4) com indicação de palpite
   feito/pendente; cada item linka para `/jogos`.
5. **Progresso de palpites** (`betCount/total`) → `/jogos` (move o bloco atual).
6. `PendingBonus` (mantém).

Estado "sem bolão" (atual) é preservado.

## Jogos → `/jogos`

O conteúdo atual de `src/app/(app)/page.tsx` (MatchesExplorer + palpites) migra
quase intacto para `src/app/(app)/jogos/page.tsx`. O `/` é reconstruído como hub.

## Componente puro testável

`derivePositionSummary(rows, userId)` → `{ position, totalPoints, top3 }` a partir do
retorno de `getRanking`. Função pura → teste unitário (TDD). O resto (Server
Components, navegação) é validado manualmente via `/run`.

## Arquivos

**Novos**
- `src/app/(app)/jogos/page.tsx`
- `src/components/layout/nav-items.ts`
- `src/components/layout/primary-nav.tsx` (client)
- `src/components/layout/user-menu.tsx` (client)
- `src/components/home/position-card.tsx`
- `src/components/home/quick-links.tsx`
- `src/components/home/next-matches.tsx`
- `src/lib/position-summary.ts` + `src/lib/position-summary.test.ts`

**Reescritos**
- `src/app/(app)/page.tsx` (hub)
- `src/components/layout/app-header.tsx`
- `src/components/layout/bottom-nav.tsx`
- `src/app/(app)/layout.tsx`

## Não-objetivos (YAGNI)

- Nenhuma mudança em scoring, dados ou rotas existentes além de `/jogos`.
- Sem refatoração não relacionada nas telas de destino (knockout/confronto/etc.).
