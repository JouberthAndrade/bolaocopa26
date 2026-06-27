-- Double-check de resultado (anti-VAR): um placar FINISHED só é pontuado depois
-- de confirmado em dois ticks consecutivos do sync. Ver result-confirmation.ts.

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "resultConfirmed" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: jogos já pontuados continuam travados (confirmados) — não queremos
-- re-processar resultados históricos corretos. Correções pontuais (ex.: jogo
-- pontuado com placar errado) devem ser refeitas via /api/admin/set-result.
UPDATE "Match" SET "resultConfirmed" = true WHERE "status" = 'FINISHED' AND "scored" = true;
