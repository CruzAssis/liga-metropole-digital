/**
 * Teste do calculo de classificacao.
 *
 * O dossie do projeto marca a ausencia deste teste como risco: a tabela e o
 * coracao do produto e o argumento de venda contra "liga que morre na terceira
 * rodada". Se ela erra, o app perde a unica coisa que o justifica.
 *
 * Nao toca no banco — computeStandings e pura de proposito.
 *
 * Rodar: `bun test tests/standings.test.ts`
 */
import { describe, expect, test } from "bun:test";
import { computeStandings, type StandingMatch, type StandingTeam } from "../src/lib/standings";

const team = (id: string, name: string, lado: string | null = "A"): StandingTeam => ({
  id, name, short_name: name.slice(0, 3).toUpperCase(), logo_url: null, lado,
});

const game = (
  host: string, hostScore: number | null,
  visitor: string, visitorScore: number | null,
): StandingMatch => ({
  host_team_id: host, visitor_team_id: visitor,
  host_score: hostScore, visitor_score: visitorScore,
});

const byId = (rows: ReturnType<typeof computeStandings>, id: string) =>
  rows.find((r) => r.team.id === id)!;

describe("computeStandings — pontuacao basica", () => {
  const teams = [team("a", "Alfa"), team("b", "Bravo"), team("c", "Charlie")];

  test("vitoria vale 3, empate 1, derrota 0", () => {
    const rows = computeStandings(teams, [game("a", 2, "b", 1), game("b", 0, "c", 0)]);
    expect(byId(rows, "a").points).toBe(3);
    expect(byId(rows, "a").wins).toBe(1);
    expect(byId(rows, "b").points).toBe(1);
    expect(byId(rows, "b").losses).toBe(1);
    expect(byId(rows, "b").draws).toBe(1);
    expect(byId(rows, "c").points).toBe(1);
  });

  test("gols pro e contra contam dos dois lados", () => {
    const rows = computeStandings(teams, [game("a", 3, "b", 1)]);
    expect(byId(rows, "a").gf).toBe(3);
    expect(byId(rows, "a").ga).toBe(1);
    expect(byId(rows, "a").gd).toBe(2);
    expect(byId(rows, "b").gf).toBe(1);
    expect(byId(rows, "b").ga).toBe(3);
    expect(byId(rows, "b").gd).toBe(-2);
  });

  test("pontuacao customizada da competicao e respeitada", () => {
    const rows = computeStandings(teams, [game("a", 1, "b", 0)], {
      points_win: 2, points_draw: 1, points_loss: 0,
    });
    expect(byId(rows, "a").points).toBe(2);
  });

  test("time sem partida aparece zerado, nao some da tabela", () => {
    const rows = computeStandings(teams, [game("a", 1, "b", 0)]);
    expect(rows).toHaveLength(3);
    expect(byId(rows, "c").played).toBe(0);
    expect(byId(rows, "c").group_label).toBe("A");
  });
});

describe("computeStandings — partida sem placar", () => {
  const teams = [team("a", "Alfa"), team("b", "Bravo")];

  // Era o bug do WO: applyAutoWO gravava status='wo' sem placar, o calculo
  // lia null como 0 e dava 1 ponto para cada time. O time que nao apareceu
  // pontuava pelo WO que sofreu.
  test("placar nulo nao vira 0x0 nem gera ponto", () => {
    const rows = computeStandings(teams, [game("a", null, "b", null)]);
    expect(byId(rows, "a").points).toBe(0);
    expect(byId(rows, "b").points).toBe(0);
    expect(byId(rows, "a").played).toBe(0);
    expect(byId(rows, "b").played).toBe(0);
  });

  test("placar pela metade tambem e ignorado", () => {
    const rows = computeStandings(teams, [game("a", 3, "b", null)]);
    expect(byId(rows, "a").played).toBe(0);
    expect(byId(rows, "a").points).toBe(0);
  });

  test("WO com placar 3x0 pontua so para quem venceu", () => {
    const rows = computeStandings(teams, [game("a", 3, "b", 0)]);
    expect(byId(rows, "a").points).toBe(3);
    expect(byId(rows, "b").points).toBe(0);
    expect(byId(rows, "b").losses).toBe(1);
  });
});

describe("computeStandings — desempate", () => {
  const teams = [team("a", "Alfa"), team("b", "Bravo"), team("c", "Charlie")];

  test("saldo de gols desempata pontos iguais", () => {
    const rows = computeStandings(teams, [
      game("a", 5, "c", 0), // Alfa: 3 pts, SG +5
      game("b", 1, "c", 0), // Bravo: 3 pts, SG +1
    ]);
    expect(rows[0].team.id).toBe("a");
    expect(rows[1].team.id).toBe("b");
  });

  test("gols pro desempata quando pontos e saldo empatam", () => {
    const rows = computeStandings(teams, [
      game("a", 3, "c", 1), // Alfa: 3 pts, SG +2, GP 3
      game("b", 2, "c", 0), // Bravo: 3 pts, SG +2, GP 2
    ]);
    expect(rows[0].team.id).toBe("a");
    expect(rows[1].team.id).toBe("b");
  });

  test("confronto direto entra quando configurado antes do saldo", () => {
    // Alfa e Bravo empatam em 3 pontos. Bravo tem saldo melhor (+4 contra +1),
    // mas perdeu o confronto direto para o Alfa. Quem fica na frente depende
    // de qual criterio a competicao coloca primeiro.
    const matches = [
      game("a", 1, "b", 0), // Alfa venceu o confronto direto
      game("b", 5, "c", 0), // e o Bravo inflou o saldo contra o Charlie
    ];
    const comSaldo = computeStandings(teams, matches, {
      tiebreakers: ["points", "gd", "gf", "name"],
    });
    const comConfronto = computeStandings(teams, matches, {
      tiebreakers: ["points", "head_to_head", "gd", "gf", "name"],
    });

    expect(byId(comSaldo, "a").points).toBe(3);
    expect(byId(comSaldo, "b").points).toBe(3);
    expect(byId(comSaldo, "a").gd).toBe(1);
    expect(byId(comSaldo, "b").gd).toBe(4);

    expect(comSaldo[0].team.id).toBe("b");     // saldo manda
    expect(comConfronto[0].team.id).toBe("a"); // confronto direto manda
  });

  test("ordem e estavel: mesma entrada, mesma saida", () => {
    const teamsEmpatados = [team("z", "Zulu"), team("y", "Yankee"), team("x", "Xray")];
    const first = computeStandings(teamsEmpatados, []).map((r) => r.team.id);
    const second = computeStandings(teamsEmpatados, []).map((r) => r.team.id);
    expect(first).toEqual(second);
  });
});

describe("computeStandings — Mandantes e Visitantes tem tabela propria", () => {
  // O formato vendido: cada lado corre a propria tabela e tem o proprio campeao.
  const teams = [
    team("m1", "Mandante Um", "A"),
    team("m2", "Mandante Dois", "A"),
    team("v1", "Visitante Um", "B"),
    team("v2", "Visitante Dois", "B"),
  ];

  test("as linhas saem agrupadas por lado", () => {
    const rows = computeStandings(teams, [
      game("m1", 1, "v1", 0),
      game("m2", 5, "v2", 0),
    ]);
    expect(rows.map((r) => r.group_label)).toEqual(["A", "A", "B", "B"]);
  });

  test("um time com muitos gols no lado B nao passa na frente do lado A", () => {
    const rows = computeStandings(teams, [game("v1", 9, "m1", 0)]);
    // v1 tem 3 pontos e m1 zero, mas a lista comeca pelo lado A mesmo assim.
    expect(rows[0].group_label).toBe("A");
    expect(byId(rows, "v1").points).toBe(3);
  });
});

describe("computeStandings — temporada completa 10x10", () => {
  // Formato da Temporada Fundadora: 10 mandantes x 10 visitantes, 10 rodadas,
  // 100 partidas. Confere que a contabilidade fecha no volume real.
  const hosts = Array.from({ length: 10 }, (_, i) => team(`h${i}`, `Mandante ${i}`, "A"));
  const visitors = Array.from({ length: 10 }, (_, i) => team(`v${i}`, `Visitante ${i}`, "B"));

  const matches: StandingMatch[] = [];
  for (let r = 0; r < 10; r++) {
    for (let i = 0; i < 10; i++) {
      matches.push(game(`h${i}`, 1, `v${(i + r) % 10}`, 1)); // tudo 1x1
    }
  }

  test("100 partidas, todo time com 10 jogos e 10 pontos", () => {
    const rows = computeStandings([...hosts, ...visitors], matches);
    expect(matches).toHaveLength(100);
    expect(rows).toHaveLength(20);
    for (const row of rows) {
      expect(row.played).toBe(10);
      expect(row.draws).toBe(10);
      expect(row.points).toBe(10);
    }
  });
});
