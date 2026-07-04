// Validação do corpo do endpoint manual de resultados (/api/admin/set-result).
// PURA (só zod) para ser testável sem banco. Aceita um único resultado ou uma
// lista; cada item identifica o jogo por externalId (id da Football-Data) OU
// por par de códigos ISO (homeCode/awayCode).

import { z } from "zod";

export const manualResultSchema = z
  .object({
    externalId: z.string().min(1).optional(),
    homeCode: z.string().min(1).optional(),
    awayCode: z.string().min(1).optional(),
    homeScore: z.number().int().min(0).max(99),
    awayScore: z.number().int().min(0).max(99),
    penaltyWinner: z.enum(["HOME", "AWAY"]).optional(),
  })
  .refine((d) => !!d.externalId || (!!d.homeCode && !!d.awayCode), {
    message: "Informe externalId OU homeCode + awayCode",
  });

export type ManualResultInput = z.infer<typeof manualResultSchema>;

/**
 * Payload de escrita do resultado manual (Match.update). Lançamento manual é
 * autoritativo: marca FINISHED, pula o double-check (resultConfirmed=true) e
 * força a (re)pontuação (scored=false). `penaltyWinner` só entra quando
 * informado — omitido, PRESERVA o valor já capturado pelo sync (apagá-lo
 * cancelaria o bônus de quem acertou quem avança nos pênaltis).
 */
export function manualResultUpdateData(r: ManualResultInput) {
  return {
    homeScore: r.homeScore,
    awayScore: r.awayScore,
    status: "FINISHED" as const,
    scored: false,
    resultConfirmed: true,
    ...(r.penaltyWinner ? { penaltyWinner: r.penaltyWinner } : {}),
  };
}

/** Corpo aceito: um objeto solto OU { results: [...] }. Normaliza para array. */
export const manualResultsBodySchema = z.union([
  z.object({ results: z.array(manualResultSchema).min(1) }).transform((b) => b.results),
  manualResultSchema.transform((r) => [r]),
]);
