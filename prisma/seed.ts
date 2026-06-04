import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

// Seed mínimo: cria apenas o torneio, o usuário demo e o bolão de exemplo.
// As seleções e os jogos vêm exclusivamente do sync com a API oficial
// (Football-Data). NÃO inserir times/partidas mockados aqui — eles poluem
// os grupos reais. Para popular os jogos use `npm run sync:matches`.
async function main() {
  console.log("🌱 Seed iniciando…");

  const tournament = await db.tournament.upsert({
    where: { externalId: "2000" },
    update: {},
    create: { name: "Copa do Mundo FIFA 2026", externalId: "2000", season: "2026" },
  });

  // Usuário demo
  const passwordHash = await bcrypt.hash("12345678", 12);
  const user = await db.user.upsert({
    where: { email: "demo@bolao.com" },
    update: {},
    create: { name: "Demo", email: "demo@bolao.com", passwordHash },
  });

  // Bolão demo
  const existing = await db.pool.findUnique({ where: { slug: "JOGAJUNTO" } });
  if (!existing) {
    await db.pool.create({
      data: {
        name: "JogaJunto 2026",
        slug: "JOGAJUNTO",
        description: "Bolão de exemplo",
        currency: "BRL",
        betsVisibility: "AFTER_LOCK",
        tournamentId: tournament.id,
        ownerId: user.id,
        scoringRule: { create: {} },
        prizeTiers: { create: [{ position: 1, percentage: 100 }] },
        memberships: { create: { userId: user.id, role: "OWNER", paid: true } },
        invites: { create: { code: "JOGA2026" } },
      },
    });
  }

  console.log("✅ Seed concluído. Login: demo@bolao.com / 12345678");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
