-- Artilharia da Copa: snapshot dos top marcadores.
-- O cron apaga e reinsere os top N a cada sync; a tela lê ordenado por `position`.

-- CreateTable
CREATE TABLE "TopScorer" (
    "id" SERIAL NOT NULL,
    "playerName" TEXT NOT NULL,
    "playerPhoto" TEXT NOT NULL,
    "teamName" TEXT NOT NULL,
    "teamLogo" TEXT NOT NULL,
    "nationality" TEXT NOT NULL,
    "goals" INTEGER NOT NULL,
    "assists" INTEGER NOT NULL,
    "appearances" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TopScorer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TopScorer_position_idx" ON "TopScorer"("position");
