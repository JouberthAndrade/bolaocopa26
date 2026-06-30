// Intervalo do "dia de hoje" no fuso do torneio (America/Sao_Paulo), em instantes
// UTC — pronto para filtrar Match.kickoffAt (armazenado em UTC).

const TZ = "America/Sao_Paulo";
// Brasil não tem horário de verão desde 2019 → offset fixo -03:00.
const SP_OFFSET = "-03:00";

/**
 * Limites do dia atual de São Paulo, como instantes UTC.
 * `start` = 00:00:00.000 SP; `end` = 23:59:59.999 SP.
 */
export function saoPauloDayRange(now: Date = new Date()): { start: Date; end: Date } {
  // Data civil (YYYY-MM-DD) de "agora" no fuso de SP.
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  const start = new Date(`${ymd}T00:00:00.000${SP_OFFSET}`);
  const end = new Date(`${ymd}T23:59:59.999${SP_OFFSET}`);
  return { start, end };
}
