# 🏆 Bolão Copa do Mundo FIFA 2026

Plataforma de bolão privado da Copa 2026: crie bolões, convide amigos, palpite em 2 cliques e acompanhe o ranking em tempo quase real.

Stack: **Next.js 15 (App Router) + TypeScript + Prisma + PostgreSQL + Auth.js v5 + Tailwind**.
Arquitetura completa em [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

## Pré-requisitos
- Node 18+ (testado em 24)
- PostgreSQL (local, Neon ou Supabase)

## Configuração

```bash
# 1. Dependências
npm install

# 2. Variáveis de ambiente
cp .env.example .env
#   - defina DATABASE_URL
#   - gere AUTH_SECRET:  npx auth secret
#   - (opcional) AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET
#   - FOOTBALL_DATA_TOKEN (competição 2000)
#   - CRON_SECRET (qualquer string forte)

# 3. Banco + dados demo
npm run db:push      # cria as tabelas
npm run db:seed      # popula times/jogos demo + usuário demo

# 4. Rodar
npm run dev
```

Acesse http://localhost:3000 e entre com **demo@bolao.com / 12345678** (criado pelo seed).
Bolão de exemplo: `/b/JOGAJUNTO` · convite `JOGA2026`.

## Importar jogos reais da Copa

Com `FOOTBALL_DATA_TOKEN` configurado:

```bash
npm run sync:matches
```

Em produção, o Vercel Cron chama `/api/cron/sync-matches` (a cada 15 min) e
`/api/cron/score` (a cada 10 min) automaticamente — ver [vercel.json](vercel.json).
Os endpoints exigem o header `Authorization: Bearer $CRON_SECRET`.

## Scripts

| Comando | Descrição |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção (gera Prisma Client) |
| `npm run db:push` | Aplica o schema no banco |
| `npm run db:seed` | Popula dados demo |
| `npm run db:studio` | Prisma Studio |
| `npm run sync:matches` | Sincroniza jogos da Football-Data |
| `npm run typecheck` | Checagem de tipos |

## Estrutura

```
src/
├── app/            # App Router (auth, app, api)
├── components/     # UI + features (match, pool, profile)
├── server/
│   ├── actions/    # Server Actions (mutations)
│   ├── services/   # sync, scoring, ranking, feed
│   ├── providers/  # adapter Football-Data (trocável)
│   └── guards.ts   # autorização
├── lib/            # db, env, utils, validações
└── auth.ts         # Auth.js v5
prisma/             # schema + seed
```

## Segurança implementada
- Travamento de palpite **validado no servidor** (30 min antes do jogo)
- Constraint única de palpite por usuário/jogo/bolão
- Autorização por membership em todas as actions
- Hash de senha (bcrypt), validação de inputs com Zod
- Endpoints de cron protegidos por segredo
