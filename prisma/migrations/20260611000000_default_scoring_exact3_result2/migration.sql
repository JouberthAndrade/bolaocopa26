-- Nova regra de pontuação: placar exato = 3 pts, acertar o resultado = 2 pts.
-- 1) Novo default para bolões criados daqui em diante.
ALTER TABLE "ScoringRule" ALTER COLUMN "pointsCorrectResult" SET DEFAULT 2;

-- 2) Atualiza os bolões existentes para a nova regra.
--    (A repontuação dos palpites já finalizados é feita pelo script
--    scripts/update-scoring-rules.ts — npm run db:update-scoring.)
UPDATE "ScoringRule"
SET "pointsCorrectResult" = 2,
    "pointsCorrectDraw"   = 2,
    "pointsExactScore"    = 1;
