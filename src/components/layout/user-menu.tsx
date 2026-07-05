"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ListChecks, CalendarDays, Trophy, Receipt, User, LogOut } from "lucide-react";
import { signOutAction } from "@/server/actions/auth";
import { cn } from "@/lib/utils";

interface UserMenuProps {
  name: string | null;
  image: string | null;
}

const LINKS = [
  { href: "/jogos", label: "Jogos", icon: ListChecks },
  { href: "/calendar", label: "Agenda", icon: CalendarDays },
  { href: "/pools", label: "Bolões", icon: Trophy },
  { href: "/extrato", label: "Extrato", icon: Receipt },
  { href: "/profile", label: "Perfil", icon: User },
];

/**
 * Avatar do usuário como botão que abre um menu com os itens secundários
 * (Jogos, Agenda, Bolões, Extrato, Perfil) + Sair. Fecha ao clicar fora ou com Esc.
 * Sem dependência externa de dropdown (projeto não usa Radix).
 */
export function UserMenu({ name, image }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initial = (name ?? "?").charAt(0).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menu do usuário"
        className="flex items-center rounded-full ring-offset-background transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {image ? (
          <Image
            src={image}
            alt={name ?? "perfil"}
            width={32}
            height={32}
            className="rounded-full"
          />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-sm font-semibold">
            {initial}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-xl border border-border bg-card p-1 shadow-lg"
        >
          {name && (
            <p className="truncate px-3 py-2 text-xs text-muted-foreground">{name}</p>
          )}
          {LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                "text-foreground hover:bg-secondary",
              )}
            >
              <Icon className="h-4 w-4 text-muted-foreground" />
              {label}
            </Link>
          ))}
          <form action={signOutAction} className="border-t border-border pt-1">
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-secondary"
            >
              <LogOut className="h-4 w-4 text-muted-foreground" />
              Sair
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
