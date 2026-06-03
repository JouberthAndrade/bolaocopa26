import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Converte código ISO-2 (ex.: "BR") para emoji de bandeira. */
export function isoToFlagEmoji(iso?: string | null): string {
  if (!iso || iso.length !== 2) return "🏳️";
  const codePoints = iso
    .toUpperCase()
    .split("")
    .map((char) => 0x1f1e6 + char.charCodeAt(0) - "A".charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

export function formatCurrency(value: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(
    value,
  );
}

/** true se o palpite ainda pode ser editado (antes do lockAt). */
export function isBettable(lockAt: Date | string, now: Date = new Date()) {
  return now.getTime() < new Date(lockAt).getTime();
}
