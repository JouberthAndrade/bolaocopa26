import Link from "next/link";
import { auth } from "@/auth";
import { PrimaryNav } from "@/components/layout/primary-nav";
import { UserMenu } from "@/components/layout/user-menu";

export async function AppHeader() {
  const session = await auth();
  const user = session?.user;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1100px] items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <span className="text-xl">🏆</span>
          <span className="hidden sm:inline">Bolão 2026</span>
        </Link>

        {/* Nav primária — só no desktop (no mobile fica na barra inferior). */}
        <PrimaryNav variant="top" />

        <UserMenu name={user?.name ?? null} image={user?.image ?? null} />
      </div>
    </header>
  );
}
