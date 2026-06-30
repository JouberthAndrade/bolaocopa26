import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PRIMARY_NAV } from "@/components/layout/nav-items";

/** Atalhos grandes e tocáveis (grid 2×2) para os menus primários — foco mobile. */
export function QuickLinks() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {PRIMARY_NAV.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className="group flex items-center justify-between gap-2 rounded-2xl border border-border bg-card px-4 py-4 transition-colors hover:border-primary/60"
        >
          <span className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-primary">
              <Icon className="h-5 w-5" />
            </span>
            <span className="text-sm font-semibold">{label}</span>
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>
      ))}
    </div>
  );
}
