-- Chave estável por jogador para o UPSERT da artilharia.
-- A tabela é repovoada pelo cron, então limpamos antes de adicionar a coluna
-- NOT NULL UNIQUE (evita falha por linhas pré-existentes sem `externalId`).

DELETE FROM "TopScorer";

-- AlterTable
ALTER TABLE "TopScorer" ADD COLUMN "externalId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "TopScorer_externalId_key" ON "TopScorer"("externalId");
