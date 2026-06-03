/**
 * Mapa de código FIFA/Football-Data (3 letras) → código ISO-2 do flagcdn.com
 * Inclui casos especiais: ENG→gb-eng, SCO→gb-sct, WAL→gb-wls, NIR→gb-nir
 */
export const FIFA_TO_FLAGCDN: Record<string, string> = {
  AFG: "af", ALB: "al", ALG: "dz", AND: "ad", ANG: "ao",
  ARG: "ar", ARM: "am", ARU: "aw", ASA: "as", AUS: "au",
  AUT: "at", AZE: "az", BAH: "bs", BAN: "bd", BDI: "bi",
  BEL: "be", BEN: "bj", BER: "bm", BHU: "bt", BIH: "ba",
  BLR: "by", BLZ: "bz", BOL: "bo", BOT: "bw", BRA: "br",
  BRN: "bh", BRU: "bn", BUL: "bg", BUR: "bf", CAM: "kh",
  CAN: "ca", CAY: "ky", CGO: "cg", CHA: "td", CHI: "cl",
  CHN: "cn", CIV: "ci", CMR: "cm", COD: "cd", COK: "ck",
  COL: "co", COM: "km", CPV: "cv", CRC: "cr", CRO: "hr",
  CUB: "cu", CUW: "cw", CYP: "cy", CZE: "cz", DEN: "dk",
  DJI: "dj", DMA: "dm", DOM: "do", ECU: "ec", EGY: "eg",
  ENG: "gb-eng", EQG: "gq", ERI: "er", ESP: "es", EST: "ee",
  ETH: "et", FIJ: "fj", FIN: "fi", FRA: "fr", FRO: "fo",
  GAB: "ga", GAM: "gm", GEO: "ge", GER: "de", GHA: "gh",
  GIB: "gi", GNB: "gw", GRE: "gr", GRN: "gd", GUA: "gt",
  GUI: "gn", GUM: "gu", GUY: "gy", HAI: "ht", HON: "hn",
  HKG: "hk", HUN: "hu", IDN: "id", IND: "in", IRL: "ie",
  IRN: "ir", IRQ: "iq", ISL: "is", ISR: "il", ITA: "it",
  JAM: "jm", JOR: "jo", JPN: "jp", KAZ: "kz", KEN: "ke",
  KGZ: "kg", KOR: "kr", KOS: "xk", KSA: "sa", KUW: "kw",
  LAO: "la", LBA: "ly", LBN: "lb", LBR: "lr", LCA: "lc",
  LES: "ls", LIE: "li", LTU: "lt", LUX: "lu", MAC: "mo",
  MAD: "mg", MAS: "my", MAR: "ma", MDA: "md", MDV: "mv",
  MEX: "mx", MKD: "mk", MLI: "ml", MLT: "mt", MNE: "me",
  MON: "mc", MOZ: "mz", MRI: "mu", MTN: "mr", MWI: "mw",
  MYA: "mm", NAM: "na", NCA: "ni", NCL: "nc", NED: "nl",
  NEP: "np", NGA: "ng", NIR: "gb-nir", NOR: "no", NZL: "nz",
  OMA: "om", PAK: "pk", PAN: "pa", PAR: "py", PER: "pe",
  PHI: "ph", PNG: "pg", POL: "pl", POR: "pt", PRK: "kp",
  PUR: "pr", QAT: "qa", ROU: "ro", RSA: "za", RUS: "ru",
  RWA: "rw", SAM: "ws", SCO: "gb-sct", SEN: "sn", SEY: "sc",
  SGP: "sg", SKN: "kn", SLE: "sl", SLV: "sv", SMR: "sm",
  SOL: "sb", SOM: "so", SRB: "rs", SRI: "lk", SSD: "ss",
  STP: "st", SUD: "sd", SUI: "ch", SUR: "sr", SVK: "sk",
  SVN: "si", SWE: "se", SWZ: "sz", SYR: "sy", TAH: "pf",
  TAN: "tz", TGA: "to", THA: "th", TJK: "tj", TKM: "tm",
  TLS: "tl", TOG: "tg", TPE: "tw", TRI: "tt", TUN: "tn",
  TUR: "tr", UAE: "ae", UGA: "ug", UKR: "ua", URU: "uy",
  USA: "us", UZB: "uz", VAN: "vu", VEN: "ve", VGB: "vg",
  VIE: "vn", VIN: "vc", WAL: "gb-wls", YEM: "ye", ZAM: "zm",
  ZIM: "zw",

  // ── ISO alpha-3 que a Football-Data v4 usa para alguns países ──
  URY: "uy", // Uruguay
  DEU: "de", // Germany
  PRY: "py", // Paraguay
  HRV: "hr", // Croatia
  CHE: "ch", // Switzerland
  NLD: "nl", // Netherlands
  HTI: "ht", // Haiti
};

/** Nomes especiais (subdivisões UK + Kosovo) que Intl.DisplayNames não resolve. */
const SUBDIVISION_PT: Record<string, string> = {
  "gb-eng": "Inglaterra",
  "gb-sct": "Escócia",
  "gb-wls": "País de Gales",
  "gb-nir": "Irlanda do Norte",
  "xk":     "Kosovo",
};

const ptBR = new Intl.DisplayNames(["pt-BR"], { type: "region" });

/**
 * Nome do país/seleção em PT-BR a partir do código ISO-2 (ou subdivisão).
 * Retorna undefined se não conseguir resolver (componente cai no nome da API).
 */
export function countryNamePtBR(isoCode: string): string | undefined {
  const lower = isoCode.toLowerCase();
  if (SUBDIVISION_PT[lower]) return SUBDIVISION_PT[lower];
  try {
    return ptBR.of(isoCode.toUpperCase()) ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Converte o código de área da Football-Data (FIFA 3 letras) para
 * o código ISO-2 usado no flagcdn.com.
 * Fallback: toma os 2 primeiros chars em minúsculo (funciona para a maioria
 * dos códigos ISO alpha-3 iguais ao ISO alpha-2).
 */
export function fifaToFlagCdn(fifaCode: string): string {
  const upper = fifaCode.toUpperCase();
  return FIFA_TO_FLAGCDN[upper] ?? fifaCode.slice(0, 2).toLowerCase();
}
