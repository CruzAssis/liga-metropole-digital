// Calculo da classificacao — funcao pura, sem banco, para poder ser testada.
//
// Esta e a parte do sistema que o produto vende: "a tabela nao some na terceira
// rodada". Se ela erra, a liga perde a credibilidade que o app existe para dar.
// Por isso mora separada do acesso a dados e tem teste em tests/standings.test.ts.

export type StandingTeam = {
  id: string;
  name: string;
  short_name?: string | null;
  logo_url?: string | null;
  lado?: string | null;
};

export type StandingMatch = {
  host_team_id: string;
  visitor_team_id: string;
  host_score: number | null;
  visitor_score: number | null;
};

export type StandingsConfig = {
  points_win?: number | null;
  points_draw?: number | null;
  points_loss?: number | null;
  tiebreakers?: string[] | null;
};

export type StandingRow = {
  team: StandingTeam;
  group_label: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
};

export const DEFAULT_TIEBREAKERS = ["points", "gd", "gf", "head_to_head", "name"];

/**
 * Monta a classificacao a partir dos times aprovados e das partidas ja
 * encerradas (filtragem por status fica com quem chama — ver FINISHED em
 * match-status.ts).
 *
 * Regras que a versao anterior errava:
 *  - Partida encerrada SEM placar nao vale resultado. Antes virava 0x0 e dava
 *    um ponto para cada lado, inclusive em WO: o time que nao apareceu
 *    pontuava pelo WO que sofreu.
 *  - O grupo do time vem do TIME (lado), nao da partida. Antes vinha de
 *    matches.group_label e um time que ainda nao jogou ficava sem grupo.
 *  - A ordem de desempate e a configurada na competicao, confronto direto
 *    incluido. Antes era fixa em pontos > SG > GP > nome.
 */
export function computeStandings(
  teams: StandingTeam[],
  matches: StandingMatch[],
  config: StandingsConfig = {},
): StandingRow[] {
  const PW = config.points_win ?? 3;
  const PD = config.points_draw ?? 1;
  const PL = config.points_loss ?? 0;
  const tiebreakers = config.tiebreakers?.length ? config.tiebreakers : DEFAULT_TIEBREAKERS;

  const stats = new Map<string, StandingRow>();
  for (const t of teams) {
    stats.set(t.id, {
      team: t,
      group_label: t.lado ?? null,
      played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: 0, points: 0,
    });
  }

  // Pontos de A contra B, para o criterio de confronto direto.
  const h2h = new Map<string, number>();
  const addH2H = (a: string, b: string, pts: number) =>
    h2h.set(`${a}|${b}`, (h2h.get(`${a}|${b}`) ?? 0) + pts);

  for (const m of matches) {
    const h = stats.get(m.host_team_id);
    const v = stats.get(m.visitor_team_id);
    if (!h || !v) continue;
    if (m.host_score == null || m.visitor_score == null) continue;

    const hs = m.host_score;
    const vs = m.visitor_score;
    h.played++; v.played++;
    h.gf += hs; h.ga += vs;
    v.gf += vs; v.ga += hs;

    if (hs > vs) {
      h.wins++; h.points += PW; v.losses++; v.points += PL;
      addH2H(m.host_team_id, m.visitor_team_id, PW);
      addH2H(m.visitor_team_id, m.host_team_id, PL);
    } else if (hs < vs) {
      v.wins++; v.points += PW; h.losses++; h.points += PL;
      addH2H(m.visitor_team_id, m.host_team_id, PW);
      addH2H(m.host_team_id, m.visitor_team_id, PL);
    } else {
      h.draws++; v.draws++; h.points += PD; v.points += PD;
      addH2H(m.host_team_id, m.visitor_team_id, PD);
      addH2H(m.visitor_team_id, m.host_team_id, PD);
    }
  }

  for (const s of stats.values()) s.gd = s.gf - s.ga;

  const criterion = (key: string, a: StandingRow, b: StandingRow): number => {
    switch (key) {
      case "points": return b.points - a.points;
      case "gd":     return b.gd - a.gd;
      case "gf":     return b.gf - a.gf;
      case "ga":     return a.ga - b.ga;
      case "wins":   return b.wins - a.wins;
      case "head_to_head": {
        const ab = h2h.get(`${a.team.id}|${b.team.id}`);
        const ba = h2h.get(`${b.team.id}|${a.team.id}`);
        if (ab === undefined || ba === undefined) return 0;
        return ba - ab;
      }
      case "name": return String(a.team.name).localeCompare(String(b.team.name), "pt-BR");
      default:     return 0;
    }
  };

  // Mandantes e Visitantes tem tabela propria e campeao proprio: agrupa
  // primeiro, ordena dentro do grupo depois.
  return Array.from(stats.values()).sort((a, b) => {
    const ga = a.group_label ?? "";
    const gb = b.group_label ?? "";
    if (ga !== gb) return ga.localeCompare(gb, "pt-BR");
    for (const key of tiebreakers) {
      const cmp = criterion(key, a, b);
      if (cmp !== 0) return cmp;
    }
    // Criterio final estavel, para a ordem nao variar entre requisicoes.
    return String(a.team.id).localeCompare(String(b.team.id));
  });
}
