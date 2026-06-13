-- Adiciona a rodada (matchday) das partidas.
-- Na fase de grupos assume os valores 1, 2 ou 3; nulo enquanto não definido.

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "matchday" INTEGER;

-- Índice para o filtro por grupo + rodada na listagem de jogos.
CREATE INDEX "Match_group_matchday_idx" ON "Match"("group", "matchday");
