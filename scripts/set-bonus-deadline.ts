/**
 * Confere e ajusta o prazo dos palpites de bônus (campeão/vice/artilheiro).
 *
 * O travamento (servidor e UI) usa Pool.entryDeadline — este script lista o
 * valor atual de cada bolão e grava o novo prazo.
 *
 * Uso (aponte DATABASE_URL para produção):
 *   npm run db:set-bonus-deadline                       → todos os bolões, 11/06/2026 16:00 BRT
 *   npm run db:set-bonus-deadline -- --slug QUINTINHA   → só o bolão do slug
 *   npm run db:set-bonus-deadline -- --at 2026-06-11T19:00:00.000Z
 *   npm run db:set-bonus-deadline -- --dry-run          → só mostra, não grava
 */
import { db } from "@/lib/db";

// 16:00 de 11/06/2026 no horário de Brasília (UTC-3) = 19:00 UTC.
const DEFAULT_DEADLINE = "2026-06-11T19:00:00.000Z";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const BRT: Intl.DateTimeFormatOptions = {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

async function main() {
  const slug = arg("slug")?.toUpperCase();
  const at = new Date(arg("at") ?? DEFAULT_DEADLINE);
  const dryRun = process.argv.includes("--dry-run");
  if (isNaN(+at)) throw new Error(`Data inválida em --at`);

  const pools = await db.pool.findMany({
    where: slug ? { slug } : undefined,
    select: { id: true, slug: true, name: true, entryDeadline: true },
  });
  if (pools.length === 0) {
    console.log(slug ? `Nenhum bolão com slug ${slug}.` : "Nenhum bolão encontrado.");
    return;
  }

  console.log(`🔒 Novo prazo: ${at.toLocaleString("pt-BR", BRT)} (BRT) — ${at.toISOString()}\n`);
  for (const p of pools) {
    const current = p.entryDeadline
      ? `${p.entryDeadline.toLocaleString("pt-BR", BRT)} (BRT)`
      : "não definido (usa fallback BONUS_DEADLINE)";
    console.log(`   • ${p.slug} (${p.name}) — atual: ${current}`);
    if (!dryRun) {
      await db.pool.update({ where: { id: p.id }, data: { entryDeadline: at } });
      console.log(`     ✅ atualizado`);
    }
  }
  if (dryRun) console.log("\n(dry-run: nada foi gravado)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
