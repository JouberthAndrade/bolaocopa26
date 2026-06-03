import Link from "next/link";
import Image from "next/image";
import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export async function AppHeader() {
  const session = await auth();
  const user = session?.user;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1100px] items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <span className="text-xl">🏆</span>
          <span>Bolão 2026</span>
        </Link>
        <div className="flex items-center gap-3">
          {user?.image ? (
            <Image
              src={user.image}
              alt={user.name ?? "perfil"}
              width={32}
              height={32}
              className="rounded-full"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-sm font-semibold">
              {(user?.name ?? "?").charAt(0).toUpperCase()}
            </div>
          )}
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <Button type="submit" variant="ghost" size="icon" aria-label="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
