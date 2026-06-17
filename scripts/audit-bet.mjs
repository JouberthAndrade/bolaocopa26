// Auditoria de um palpite "que mudou sozinho".
// Como NÃO há tabela de histórico (Bet só tem createdAt/updatedAt), a auditoria
// se apoia em: valor atual + os dois timestamps + listar o palpite em TODOS os
// bolões do usuário (a chave é única por userId+poolId+matchId).
//
// Uso (com o DATABASE_URL de PRODUÇÃO no ambiente):
//   DATABASE_URL="postgresql://...neon..." node scripts/audit-bet.mjs "Gustavo" "iq"
//   arg1 = trecho do nome OU e-mail do usuário
//   arg2 = countryCode de um dos times do jogo (ex.: iq = Iraque)

import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

const who = process.argv[2] ?? "";
const teamCode = process.argv[3] ?? "iq";

const users = await db.user.findMany({
  where: {
    OR: [
      { name: { contains: who, mode: "insensitive" } },
      { email: { contains: who, mode: "insensitive" } },
    ],
  },
  select: { id: true, name: true, email: true },
});
console.log("Usuários encontrados:", users);

const matches = await db.match.findMany({
  where: {
    OR: [{ homeTeam: { countryCode: teamCode } }, { awayTeam: { countryCode: teamCode } }],
  },
  select: {
    id: true, kickoffAt: true, lockAt: true, status: true,
    homeScore: true, awayScore: true,
    homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } },
  },
  orderBy: { kickoffAt: "asc" },
});

const bets = await db.bet.findMany({
  where: {
    userId: { in: users.map((u) => u.id) },
    matchId: { in: matches.map((m) => m.id) },
  },
  select: {
    homeGuess: true, awayGuess: true, pointsEarned: true,
    createdAt: true, updatedAt: true,
    match: {
      select: {
        lockAt: true, status: true,
        homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } },
      },
    },
    pool: { select: { name: true, slug: true } },
  },
  orderBy: { updatedAt: "asc" },
});

console.log(`\nPalpites do usuário nesses jogos (${bets.length}):`);
for (const b of bets) {
  const editado = b.createdAt.getTime() !== b.updatedAt.getTime();
  const editadoAposLock = b.updatedAt.getTime() > b.match.lockAt.getTime();
  console.log({
    jogo: `${b.match.homeTeam.name} x ${b.match.awayTeam.name}`,
    bolao: b.pool.slug,
    palpite: `${b.homeGuess} x ${b.awayGuess}`,
    pontos: b.pointsEarned,
    criadoEm: b.createdAt.toISOString(),
    editado: editado ? b.updatedAt.toISOString() : "NUNCA (igual à criação)",
    // se foi "editado" depois do lock, algo gravou fora da tela (SQL/script)
    suspeitoEscritaAposLock: editadoAposLock,
  });
}

await db.$disconnect();
