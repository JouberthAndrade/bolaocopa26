// Normalização e casamento de nomes de seleções. Os palpites dos bots vêm em
// inglês (docs/*.json) e precisam casar com os nomes vindos do provedor
// (Football-Data), que às vezes divergem ("USA" x "United States",
// "South Korea" x "Korea Republic"). Função PURA — testável sem banco.

/**
 * Grupos de sinônimos. Cada lista vira um único nome canônico (o primeiro item),
 * já normalizado. Inclua aqui qualquer divergência conhecida entre o JSON e o DB.
 */
const ALIASES: string[][] = [
  ["usa", "united states", "united states of america"],
  ["south korea", "korea republic", "republic of korea", "korea"],
  ["czech republic", "czechia"],
  ["ivory coast", "cote d ivoire"], // acento/apóstrofo já removidos na normalização
  ["iran", "ir iran"],
  ["dr congo", "democratic republic of the congo", "congo dr"],
  ["bosnia herzegovina", "bosnia"],
];

/** Mapa nome-normalizado -> canônico, derivado de ALIASES. */
const CANONICAL = new Map<string, string>();
for (const group of ALIASES) {
  const canon = group[0];
  for (const variant of group) CANONICAL.set(variant, canon);
}

/**
 * Forma comparável de um nome: minúsculas, sem acentos, sem pontuação, sem a
 * palavra "and"/"&", espaços colapsados, e com aliases resolvidos.
 */
export function normalizeTeamName(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove diacríticos
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ") // pontuação -> espaço
    .replace(/\band\b/g, " ") // remove conjunção
    .replace(/\s+/g, " ")
    .trim();

  return CANONICAL.get(base) ?? base;
}

/** true quando dois nomes representam a mesma seleção. */
export function teamNamesMatch(a: string, b: string): boolean {
  return normalizeTeamName(a) === normalizeTeamName(b);
}

/**
 * Mapa nome-em-inglês (normalizado) -> código ISO usado no DB (Team.countryCode).
 * Os palpites vêm em inglês; o DB guarda nomes em português, então casamos por
 * código ISO — estável e imune a acento/idioma. Cobre as 48 seleções da Copa.
 */
const NAME_TO_CODE: Record<string, string> = {
  mexico: "mx",
  "south africa": "za",
  "south korea": "kr",
  "czech republic": "cz",
  canada: "ca",
  "bosnia herzegovina": "ba",
  qatar: "qa",
  switzerland: "ch",
  brazil: "br",
  morocco: "ma",
  haiti: "ht",
  scotland: "gb-sct",
  usa: "us",
  paraguay: "py",
  australia: "au",
  turkey: "tr",
  germany: "de",
  curacao: "cw",
  "ivory coast": "ci",
  ecuador: "ec",
  netherlands: "nl",
  japan: "jp",
  sweden: "se",
  tunisia: "tn",
  belgium: "be",
  egypt: "eg",
  iran: "ir",
  "new zealand": "nz",
  spain: "es",
  "cape verde": "cv",
  "saudi arabia": "sa",
  uruguay: "uy",
  france: "fr",
  senegal: "sn",
  iraq: "iq",
  norway: "no",
  argentina: "ar",
  algeria: "dz",
  austria: "at",
  jordan: "jo",
  portugal: "pt",
  "dr congo": "cd",
  uzbekistan: "uz",
  colombia: "co",
  england: "gb-eng",
  croatia: "hr",
  ghana: "gh",
  panama: "pa",
};

/** Código ISO da seleção a partir do nome em inglês, ou null se desconhecido. */
export function teamCode(name: string): string | null {
  return NAME_TO_CODE[normalizeTeamName(name)] ?? null;
}
