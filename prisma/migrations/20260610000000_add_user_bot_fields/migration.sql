-- CreateEnum
CREATE TYPE "BotKind" AS ENUM ('CLAUDINHO', 'GEPETO');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isBot" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "botKind" "BotKind";
