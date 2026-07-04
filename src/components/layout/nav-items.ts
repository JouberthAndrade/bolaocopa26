import {
  PencilLine,
  Swords,
  Eye,
  ListOrdered,
  LayoutGrid,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/**
 * Itens primários da navegação (bottom nav no mobile / top nav no desktop).
 * Palpitar vem primeiro: é a ação nº 1 do produto e precisa estar sempre ao
 * alcance do polegar.
 */
export const PRIMARY_NAV: NavItem[] = [
  { href: "/", label: "Palpitar", icon: PencilLine },
  { href: "/knockout", label: "Mata-mata", icon: Swords },
  { href: "/confronto", label: "Confronto", icon: Eye },
  { href: "/b", label: "Ranking", icon: ListOrdered },
  { href: "/groups", label: "Grupos", icon: LayoutGrid },
];
