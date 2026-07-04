"use client";

import Link, { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type PoolTab = "ranking" | "confronto" | "artilharia" | "regras";

const TABS: { key: PoolTab; label: string }[] = [
  { key: "ranking", label: "Ranking" },
  { key: "confronto", label: "Confronto" },
  { key: "artilharia", label: "Artilharia" },
  { key: "regras", label: "Regras" },
];

/**
 * Barra de abas do bolão. Cada troca é uma navegação de servidor (a página é
 * `force-dynamic`); sem feedback o toque parecia travado no celular. Aqui a aba
 * tocada mostra um spinner imediato via `useLinkStatus` enquanto o servidor
 * responde — o resto do conteúdo permanece visível até a nova aba chegar.
 */
export function PoolTabs({ slug, active }: { slug: string; active: PoolTab }) {
  return (
    <nav className="flex gap-1 rounded-lg border border-border bg-card p-1">
      {TABS.map((t) => {
        const isActive = active === t.key;
        return (
          <Link
            key={t.key}
            href={`/b/${slug}?tab=${t.key}`}
            scroll={false}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex-1 rounded-md py-2 text-center text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-card",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <TabLabel label={t.label} isActive={isActive} />
          </Link>
        );
      })}
    </nav>
  );
}

function TabLabel({ label, isActive }: { label: string; isActive: boolean }) {
  const { pending } = useLinkStatus();
  return (
    <span className="relative inline-flex items-center justify-center gap-1.5">
      <span className={cn(pending && !isActive && "opacity-70")}>{label}</span>
      {pending && !isActive && (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
      )}
    </span>
  );
}
