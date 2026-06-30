import { Swords, Eye, ListOrdered, LayoutGrid, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** Itens primários da navegação (bottom nav no mobile / top nav no desktop). */
export const PRIMARY_NAV: NavItem[] = [
  { href: "/knockout", label: "Mata-mata", icon: Swords },
  { href: "/confronto", label: "Confronto", icon: Eye },
  { href: "/b", label: "Ranking", icon: ListOrdered },
  { href: "/groups", label: "Grupos", icon: LayoutGrid },
];
