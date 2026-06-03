import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const TEAMS = [
  { externalId: "demo-BR", name: "Brasil", countryCode: "BR", group: "A" },
  { externalId: "demo-AR", name: "Argentina", countryCode: "AR", group: "A" },
  { externalId: "demo-FR", name: "França", countryCode: "FR", group: "B" },
  { externalId: "demo-ES", name: "Espanha", countryCode: "ES", group: "B" },
  { externalId: "demo-PT", name: "Portugal", countryCode: "PT", group: "C" },
  { externalId: "demo-DE", name: "Alemanha", countryCode: "DE", group: "C" },
];

function at(hoursFromNow: number) {
  return new Date(Date.now() + hoursFromNow * 3600_000);
}

async function main() {
  console.log("🌱 Seed iniciando…");

  const tournament = await db.tournament.upsert({
    where: { externalId: "2000" },
    update: {},
    create: { name: "Copa do Mundo FIFA 2026", externalId: "2000", season: "2026" },
  });

  const teamMap = new Map<string, string>();
  for (const t of TEAMS) {
    const team = await db.team.upsert({
      where: { tournamentId_externalId: { tournamentId: tournament.id, externalId: t.externalId } },
      update: { name: t.name, countryCode: t.countryCode, group: t.group },
      create: { ...t, tournamentId: tournament.id },
    });
    teamMap.set(t.externalId, team.id);
  }

  // Jogos: 1 já encerrado, 1 hoje (aberto), 1 futuro
  const fixtures = [
    { ext: "demo-m1", home: "demo-BR", away: "demo-AR", kickoff: at(-3), status: "FINISHED" as const, hs: 2, as: 1 },
    { ext: "demo-m2", home: "demo-FR", away: "demo-ES", kickoff: at(2), status: "SCHEDULED" as const, hs: null, as: null },
    { ext: "demo-m3", home: "demo-PT", away: "demo-DE", kickoff: at(26), status: "SCHEDULED" as const, hs: null, as: null },
  ];

  for (const f of fixtures) {
    await db.match.upsert({
      where: { externalId: f.ext },
      update: {},
      create: {
        externalId: f.ext,
        tournamentId: tournament.id,
        homeTeamId: teamMap.get(f.home)!,
        awayTeamId: teamMap.get(f.away)!,
        homeScore: f.hs,
        awayScore: f.as,
        stage: "GROUP",
        group: "A",
        venue: "MetLife Stadium",
        kickoffAt: f.kickoff,
        lockAt: new Date(f.kickoff.getTime() - 20 * 60_000),
        status: f.status,
      },
    });
  }

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
