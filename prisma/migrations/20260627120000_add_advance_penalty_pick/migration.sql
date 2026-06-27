-- CreateEnum
CREATE TYPE "Advance" AS ENUM ('HOME', 'AWAY');

-- AlterTable
ALTER TABLE "Match" ADD COLUMN "penaltyWinner" "Advance";

-- AlterTable
ALTER TABLE "Bet" ADD COLUMN "advances" "Advance";
