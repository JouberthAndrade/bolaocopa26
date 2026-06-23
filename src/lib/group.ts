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

export interface TeamStanding {
  teamId: string;
  name: string;
  countryCode: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  position: number;
}

interface MatchForStandings {
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
}

/**
 * Critérios FIFA 2026 (em ordem):
 * 1. Pontos · 2. Saldo de gols · 3. Gols marcados
 * 4-6. H2H (pontos / saldo / gols) entre empatados
 * 7. Fair play (não implementado) · 8. Estabilidade
 */
export function computeGroupStandings(
  teams: Array<{ id: string; name: string; countryCode: string }>,
  matches: MatchForStandings[],
): TeamStanding[] {
  type Stats = Omit<TeamStanding, "position">;
  const map = new Map<string, Stats>();

  for (const t of teams) {
    map.set(t.id, {
      teamId: t.id, name: t.name, countryCode: t.countryCode,
      played: 0, won: 0, drawn: 0, lost: 0,
      goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0,
    });
  }

  const finished = matches.filter(
    (m) => m.homeScore != null && m.awayScore != null,
  );

  for (const m of finished) {
    const h = map.get(m.homeTeamId);
    const a = map.get(m.awayTeamId);
    if (!h || !a) continue;
    const hg = m.homeScore!, ag = m.awayScore!;

    h.played++; a.played++;
    h.goalsFor += hg; h.goalsAgainst += ag;
    a.goalsFor += ag; a.goalsAgainst += hg;
    h.goalDiff = h.goalsFor - h.goalsAgainst;
    a.goalDiff = a.goalsFor - a.goalsAgainst;

    if (hg > ag)      { h.won++; h.points += 3; a.lost++; }
    else if (hg < ag) { a.won++; a.points += 3; h.lost++; }
    else              { h.drawn++; h.points++; a.drawn++; a.points++; }
  }

  // Pass 1: pontos → jogos disputados → saldo geral → gols marcados
  const sorted = [...map.values()].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.played !== a.played) return b.played - a.played;
    if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
    return b.goalsFor - a.goalsFor;
  });

  // Pass 2: dentro de grupos ainda empatados, aplica H2H
  const result: Stats[] = [];
  let i = 0;
  while (i < sorted.length) {
    const ref = sorted[i];
    let j = i + 1;
    while (
      j < sorted.length &&
      sorted[j].points === ref.points &&
      sorted[j].played === ref.played &&
      sorted[j].goalDiff === ref.goalDiff &&
      sorted[j].goalsFor === ref.goalsFor
    ) j++;

    const chunk = sorted.slice(i, j);
    result.push(...(chunk.length > 1 ? applyH2H(chunk, finished) : chunk));
    i = j;
  }

  return result.map((t, idx) => ({ ...t, position: idx + 1 }));
}

function applyH2H(
  tied: Array<Omit<TeamStanding, "position">>,
  allMatches: MatchForStandings[],
): Array<Omit<TeamStanding, "position">> {
  const ids = new Set(tied.map((t) => t.teamId));
  const h2h = new Map<string, { pts: number; gd: number; gf: number }>();
  for (const t of tied) h2h.set(t.teamId, { pts: 0, gd: 0, gf: 0 });

  for (const m of allMatches) {
    if (!ids.has(m.homeTeamId) || !ids.has(m.awayTeamId)) continue;
    const hg = m.homeScore!, ag = m.awayScore!;
    const ho = h2h.get(m.homeTeamId)!;
    const aw = h2h.get(m.awayTeamId)!;
    ho.gd += hg - ag; aw.gd += ag - hg;
    ho.gf += hg; aw.gf += ag;
    if (hg > ag)      ho.pts += 3;
    else if (hg < ag) aw.pts += 3;
    else              { ho.pts++; aw.pts++; }
  }

  return [...tied].sort((a, b) => {
    const ha = h2h.get(a.teamId)!, hb = h2h.get(b.teamId)!;
    if (hb.pts !== ha.pts) return hb.pts - ha.pts;
    if (hb.gd !== ha.gd) return hb.gd - ha.gd;
    return hb.gf - ha.gf;
  });
}
