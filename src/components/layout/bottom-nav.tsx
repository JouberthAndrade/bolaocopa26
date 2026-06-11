"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ListChecks, CalendarDays, Receipt, LayoutGrid, Swords, Trophy, User } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Jogos", icon: ListChecks },
  { href: "/calendar", label: "Agenda", icon: CalendarDays },
  { href: "/extrato", label: "Extrato", icon: Receipt },
  { href: "/groups", label: "Grupos", icon: LayoutGrid },
  { href: "/knockout", label: "Mata-mata", icon: Swords },
  { href: "/pools", label: "Bolões", icon: Trophy },
  { href: "/profile", label: "Perfil", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1100px] items-center justify-around">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-xs transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
