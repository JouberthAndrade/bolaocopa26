---
target: src/app/(app)/b/[slug]
total_score: 34
p0_count: 0
p1_count: 2
timestamp: 2026-07-04T13-33-42Z
slug: src-app-app-b-slug-page-tsx
---
# Critique — Pool page `src/app/(app)/b/[slug]` (Ranking / Confronto / Artilharia / Regras)

Method: DEGRADED single-context (harness policy restricts spawning sub-agents unless the user asks). Code-level only — no dev server / browser tool, so no live overlay pass.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Live states excellent, but tab switches are full server navs with zero loading feedback |
| 2 | Match System / Real World | 4 | Fluent PT-BR + football metaphors. n/a |
| 3 | User Control and Freedom | 3 | Dialog Esc/backdrop/X; tabs URL-driven (back + shareable) |
| 4 | Consistency and Standards | 4 | One card vocabulary, medal system + tabular-nums reused |
| 5 | Error Prevention | 3 | Read surface; fetch failures guarded. n/a |
| 6 | Recognition Rather Than Recall | 3 | Tabs/nav labeled; race modes Rodada/Dia/Jogo unexplained |
| 7 | Flexibility and Efficiency | 3 | No shortcuts; every tab tap is full server round-trip; race scrubber nice |
| 8 | Aesthetic and Minimalist Design | 4 | Focused, on-brand, real personality. n/a |
| 9 | Error Recovery | 3 | Plain-language errors but no retry button |
| 10 | Help and Documentation | 3 | Regras tab is real inline docs; race controls lack contextual help |
| **Total** | | **34/40** | **Good — solid foundation, address weak spots** |

## Anti-Patterns Verdict

Does NOT look AI-generated — the opposite of slop. Committed identity (field-green + trophy-gold on deep navy), real personality: the "Corrida pelo prêmio" race track with checkered finish line + prize chest, medal tiers, live pulses, named AI bots (Claudinho/Gepeto). Category-reflex check passes at both altitudes.

Deterministic scan: `detect.mjs` over page + ranking-table + race-track + top-scorers returned `[]` (clean). The one gradient (`from-violet-500/15 to-fuchsia-500/10` on bot rows) is a purposeful background tint, not the banned gradient-text.

Visual overlays: none available (no running server / browser tool).

## Overall Impression

Well-crafted, confident product surface, above the category bar. Consistent visual system, near-complete empty/loading/error states, and the race track delivers on "a energia mora no ranking." The gap is two structural things that hurt the mobile-first, palpite-first mission: the primary action (palpitar) has no prominent path from this page, and tab switching feels unresponsive on a phone. Biggest opportunity: perceived responsiveness on tab changes.

## What's Working

1. The race track is the star and earns it — real overtaking (layout="position" springs), reduced-motion honored, play/scrub controls, leader crown, prize finish line. Emotional peak, built with care.
2. Disciplined state coverage — skeleton for artilharia (not spinner), teaching empty states, guarded fetch errors, useReducedMotion in both animated components.
3. One coherent vocabulary — rounded-xl border-border bg-card, medal colors, tabular-nums, reused Dialog (portal, Esc, backdrop, bottom-sheet on mobile).

## Priority Issues

[P1] Tab switches give no feedback and reload the whole page. Tab bar uses `<Link href="?tab=…">` against a force-dynamic server page; each tap re-runs server queries with no loading.tsx and no pending state. On mobile/4G, tapping Confronto/Artilharia does nothing visible for 1–2s. Fix: optimistic active-tab pending style (useLinkStatus/useTransition), or a loading.tsx skeleton, or client-side tab state suspending only the panel. Command: /impeccable optimize

[P1] Primary action (palpitar) nearly invisible here. Only route is a text-xs "Palpitar →" link in the header meta row; bottom nav (Mata-mata/Confronto/Ranking/Grupos) has no Palpitar entry. The #1 job is the least prominent element and unreachable from the thumb zone. Fix: promote palpitar to a real thumb-reachable button and/or bottom-nav item. Command: /impeccable layout

[P2] maximum-scale=1 disables pinch-zoom. viewport.maximumScale=1 in src/app/layout.tsx blocks pinch-to-zoom (WCAG 1.4.4 fail), contradicts stated WCAG AA / mobile-first goal; low-vision users can't enlarge 10–11px labels. Fix: remove maximumScale; solve iOS input-zoom with ≥16px input font instead. Command: /impeccable audit

[P2] Race controls undiscoverable and hard to hit on mobile. Rodada/Dia/Jogo toggle, scrubber, range slider have no explanation; arrow buttons (~28px) and h-1.5 range thumb are under 44px touch target. Fix: add a one-line hint/tooltip and bump hit areas to ≥44px. Command: /impeccable clarify then /impeccable adapt

## Persona Red Flags

Casey (mobile): taps Artilharia → ~1.5s nothing (no pending) → taps again. Palpitar absent from bottom bar; header link is 12px at top, out of thumb zone. Race scrubber thumb too small.

Sam (a11y): pinch-zoom disabled (maximum-scale=1). Ranking rows are role="button" divs (keyboard handlers exist, rely on default focus ring; real <button> safer). 10px uppercase labels small though contrast passes.

Rafael (competitive organizer, project persona): well served — admin InviteCard, Regras tab documents scoring/prizes ("pontos que se explicam"), clicking a rival's row opens their closed bets. Gap: "Confronto" exists both as global nav (/confronto) and pool tab — may read as duplicate.

## Minor Observations

- Contrast checks out: --muted-foreground (215 20% 65%) ~7.3:1 on --background, ~6.8:1 on --card. No washed-gray problem.
- Ranking rows better as <button> than role="button" divs.
- Fetch-error states are text-only; add a "Tentar novamente" button (heuristic #9).
- Radius scale (lg→xl→2xl→3xl) is deliberate hierarchy, not inconsistency.

## Questions to Consider

- Should tapping a tab feel instant (client-side tab state, suspend only the panel) instead of a server round-trip?
- If "palpite em dois cliques" is the mission, why is Palpitar the smallest element on the pool page and absent from the nav?
- Should the race track auto-play once on first visit so its purpose is self-evident?
