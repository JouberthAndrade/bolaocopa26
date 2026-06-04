/**
 * Normaliza o identificador de grupo para a letra amigável.
 * O provedor (Football-Data) envia "GROUP_A"; dados antigos usavam "A".
 * Ambos passam a ser exibidos como "A".
 *
 * Exemplos: "GROUP_A" → "A" · "Group A" → "A" · "A" → "A"
 */
export function normalizeGroup(raw: string): string {
  return raw.replace(/^group[_\s-]*/i, "").trim().toUpperCase();
}
