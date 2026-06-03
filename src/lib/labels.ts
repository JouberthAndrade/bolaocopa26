import type { MatchStage, MatchStatus } from "@prisma/client";

export const STAGE_LABEL: Record<MatchStage, string> = {
  GROUP: "Fase de Grupos",
  R32: "16-avos",
  R16: "Oitavas",
  QF: "Quartas",
  SF: "Semifinal",
  THIRD_PLACE: "Disputa 3º",
  FINAL: "Final",
};

export const STATUS_LABEL: Record<MatchStatus, string> = {
  SCHEDULED: "Agendado",
  LIVE: "Ao vivo",
  FINISHED: "Encerrado",
  POSTPONED: "Adiado",
};
