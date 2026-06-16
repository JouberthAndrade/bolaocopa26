-- ─────────────────────────────────────────────────────────────────────────────
-- Palpites do Gepeto (docs/gepeto.json) — jogos a partir de 2026-06-15.
--
-- Auto-resolvido: NÃO precisa de IDs de produção colados na mão.
--   • userId  -> resolvido por "botKind" = 'GEPETO'
--   • poolId  -> TODOS os bolões (cross join com "Pool")
--   • matchId -> casado por par de códigos ISO (Team.countryCode), respeitando a
--                orientação real (home/away) do jogo no banco
--
-- Pré-requisitos (assumidos como já existentes em produção):
--   • Usuário Gepeto (User.botKind = 'GEPETO')
--   • Membership do Gepeto em cada bolão
--
-- Conflito: ON CONFLICT DO NOTHING — preserva qualquer palpite já existente.
-- Idempotente: pode rodar de novo sem duplicar nada.
--
-- Espelha a lógica de scripts/seed-bots.ts (casamento por codePairKey ISO).
-- ─────────────────────────────────────────────────────────────────────────────

WITH gepeto AS (
  SELECT id AS user_id
  FROM "User"
  WHERE "botKind" = 'GEPETO'
  ORDER BY "createdAt"
  LIMIT 1
),

-- (code_team1, code_team2, placar_team1, placar_team2) — somente jogos >= 15/06.
fixtures (code1, code2, s1, s2) AS (
  VALUES
    -- Grupo A
    ('cz','za',2,1), ('mx','kr',2,1), ('cz','mx',1,1), ('za','kr',1,2),
    -- Grupo B
    ('ch','ba',2,0), ('ca','qa',2,0), ('ch','ca',1,1), ('ba','qa',2,1),
    -- Grupo C
    ('gb-sct','ma',1,1), ('br','ht',4,0), ('gb-sct','br',0,2), ('ma','ht',3,0),
    -- Grupo D
    ('us','au',2,0), ('tr','py',2,1), ('tr','us',1,1), ('py','au',2,1),
    -- Grupo E
    ('de','ci',2,1), ('ec','cw',3,0), ('cw','ci',0,2), ('ec','de',1,2),
    -- Grupo F
    ('nl','se',1,1), ('tn','jp',1,2), ('jp','se',1,1), ('tn','nl',0,2),
    -- Grupo G
    ('be','eg',2,0), ('ir','nz',1,0), ('be','ir',2,1), ('nz','eg',1,1),
    ('eg','ir',1,1), ('nz','be',0,3),
    -- Grupo H
    ('es','cv',4,0), ('sa','uy',1,2), ('es','sa',3,0), ('uy','cv',2,0),
    ('cv','sa',1,1), ('uy','es',1,2),
    -- Grupo I
    ('fr','sn',2,0), ('iq','no',0,2), ('fr','iq',3,0), ('no','sn',2,2),
    ('no','fr',1,2), ('sn','iq',2,0),
    -- Grupo J
    ('ar','dz',3,0), ('at','jo',2,0), ('ar','at',2,1), ('jo','dz',1,1),
    ('dz','at',1,2), ('jo','ar',0,3),
    -- Grupo K
    ('pt','cd',3,0), ('uz','co',1,2), ('pt','uz',2,0), ('co','cd',3,1),
    ('co','pt',1,1), ('cd','uz',1,1),
    -- Grupo L
    ('gb-eng','hr',2,1), ('gh','pa',2,1), ('gb-eng','gh',3,0), ('pa','hr',1,2),
    ('pa','gb-eng',0,3), ('hr','gh',2,1)
),

-- Resolve cada fixture para (bolão, jogo) com o palpite na orientação do DB.
resolved AS (
  SELECT
    p.id  AS pool_id,
    m.id  AS match_id,
    CASE WHEN ht."countryCode" = f.code1 THEN f.s1 ELSE f.s2 END AS home_guess,
    CASE WHEN ht."countryCode" = f.code1 THEN f.s2 ELSE f.s1 END AS away_guess
  FROM fixtures f
  JOIN "Pool"  p  ON TRUE
  JOIN "Match" m  ON m."tournamentId" = p."tournamentId"
  JOIN "Team"  ht ON ht.id = m."homeTeamId"
  JOIN "Team"  at ON at.id = m."awayTeamId"
  WHERE (
        (ht."countryCode" = f.code1 AND at."countryCode" = f.code2)
     OR (ht."countryCode" = f.code2 AND at."countryCode" = f.code1)
  )
    AND m."kickoffAt" >= TIMESTAMP '2026-06-15 00:00:00'
)

INSERT INTO "Bet" ("id", "userId", "poolId", "matchId", "homeGuess", "awayGuess", "updatedAt")
SELECT
  gen_random_uuid()::text,
  g.user_id,
  r.pool_id,
  r.match_id,
  r.home_guess,
  r.away_guess,
  now()
FROM resolved r
CROSS JOIN gepeto g
ON CONFLICT ("userId", "poolId", "matchId") DO NOTHING;

-- Conferência (opcional): quantos palpites o Gepeto tem por bolão a partir de 15/06.
-- SELECT b."poolId", COUNT(*) AS palpites
-- FROM "Bet" b
-- JOIN "User" u ON u.id = b."userId" AND u."botKind" = 'GEPETO'
-- JOIN "Match" m ON m.id = b."matchId" AND m."kickoffAt" >= TIMESTAMP '2026-06-15 00:00:00'
-- GROUP BY b."poolId";
