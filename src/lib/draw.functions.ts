import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const inputSchema = z.object({
  competitionId: z.string().uuid(),
  firstRoundDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  intervalDays: z.number().int().min(1).max(60).default(7),
});

const DEFAULT_HOME_TIME = "15:00:00";

// Brasil nao tem horario de verao desde 2019, entao America/Sao_Paulo e um
// offset fixo. Sem isto o horario da partida era interpretado no fuso do
// servidor (UTC na Vercel/Cloudflare) e a temporada inteira aparecia 3h cedo.
const BRT_OFFSET = "-03:00";

function secureShuffle<T>(array: T[]): T[] {
  const a = array.slice();
  const rand = new Uint32Array(1);
  for (let i = a.length - 1; i > 0; i--) {
    crypto.getRandomValues(rand);
    const j = rand[0] % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type TeamRow = {
  id: string;
  registration_type: "host" | "visitor";
  lado: "A" | "B";
  home_time: string | null;
  home_venue: string | null;
};

/**
 * Sorteio oficial Liga Metrópole (V7):
 *  - Confrontos APENAS Mandante × Visitante, e SOMENTE dentro do mesmo Lado.
 *  - Cada Mandante recebe todos os Visitantes do seu Lado, uma vez cada:
 *    n mandantes × n visitantes → n rodadas, n² partidas por Lado.
 *  - Data de cada rodada = firstRoundDate + (round - 1) * intervalDays.
 *  - Hora e local de cada jogo = home_time/home_venue do Mandante, em BRT.
 *
 * O tamanho vem dos times aprovados NESTA competicao, nao de constante fixa.
 * A V6 exigia exatamente 20 times em cada um dos quatro baldes (40+40) e por
 * isso recusava a Temporada Fundadora de 2026, que tem 10 mandantes e 10
 * visitantes num Lado so — e recusaria tambem o plano B de 8+8.
 *
 * O que continua obrigatorio: mandantes e visitantes em numero IGUAL dentro
 * de cada Lado. E o que garante que todo time jogue a mesma quantidade de
 * partidas; sem isso a tabela compara times com numero diferente de jogos.
 */
export const executeDraw = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: isAdmin, error: roleErr } = await supabaseAdmin.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) {
      throw new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }

    const { data: comp, error: compErr } = await supabaseAdmin
      .from("competitions")
      .select("id, draw_executed_at")
      .eq("id", data.competitionId)
      .single();
    if (compErr || !comp) {
      throw new Response(JSON.stringify({ error: "Competition not found" }), { status: 404 });
    }
    if (comp.draw_executed_at !== null) {
      throw new Response(JSON.stringify({ error: "Sorteio já executado" }), { status: 400 });
    }

    // Só os times DESTA competição. Antes o filtro era apenas status=approved,
    // então um time aprovado em outra liga entrava no sorteio desta.
    const { data: teams, error: teamsErr } = await supabaseAdmin
      .from("teams")
      .select("id, registration_type, status, lado, home_time, home_venue")
      .eq("status", "approved")
      .eq("competition_id", data.competitionId);
    if (teamsErr) throw new Error(teamsErr.message);

    const approved = (teams ?? []) as TeamRow[];
    const buckets = {
      "host-A": approved.filter((t) => t.registration_type === "host" && t.lado === "A"),
      "host-B": approved.filter((t) => t.registration_type === "host" && t.lado === "B"),
      "visitor-A": approved.filter((t) => t.registration_type === "visitor" && t.lado === "A"),
      "visitor-B": approved.filter((t) => t.registration_type === "visitor" && t.lado === "B"),
    };
    const counts = {
      "host-A": buckets["host-A"].length,
      "host-B": buckets["host-B"].length,
      "visitor-A": buckets["visitor-A"].length,
      "visitor-B": buckets["visitor-B"].length,
    };

    // Lado ativo = tem mandante E visitante. Uma liga de um lado só (o caso da
    // Temporada Fundadora) é válida; o Lado B simplesmente não é sorteado.
    const activeSides = (["A", "B"] as const).filter(
      (lado) => counts[`host-${lado}`] > 0 || counts[`visitor-${lado}`] > 0,
    );

    if (activeSides.length === 0) {
      throw new Response(
        JSON.stringify({
          error:
            "Nenhum time aprovado nesta competição. Aprove as inscrições antes de sortear.",
          counts,
        }),
        { status: 400 },
      );
    }

    const problems: string[] = [];
    for (const lado of activeSides) {
      const h = counts[`host-${lado}`];
      const v = counts[`visitor-${lado}`];
      if (h !== v) {
        problems.push(
          `Lado ${lado}: ${h} mandante(s) e ${v} visitante(s). Precisam ser iguais para todo time jogar o mesmo número de partidas.`,
        );
      } else if (h < 2) {
        problems.push(`Lado ${lado}: só ${h} time(s) por categoria. Mínimo 2.`);
      }
    }
    if (problems.length > 0) {
      throw new Response(
        JSON.stringify({ error: problems.join(" "), counts }),
        { status: 400 },
      );
    }

    type MatchInsert = {
      competition_id: string;
      stage: "group";
      round: number;
      group_label: string;
      host_team_id: string;
      visitor_team_id: string;
      status: "scheduled";
      scheduled_at: string;
      venue: string | null;
    };
    const matchRows: MatchInsert[] = [];

    const baseTime = new Date(`${data.firstRoundDate}T12:00:00Z`).getTime();
    if (!Number.isFinite(baseTime)) {
      throw new Response(JSON.stringify({ error: "Data inicial inválida" }), { status: 400 });
    }
    const dayMs = 86400000;

    for (const lado of activeSides) {
      const hosts = secureShuffle(buckets[`host-${lado}`]);
      const visitors = secureShuffle(buckets[`visitor-${lado}`]);
      const n = hosts.length; // == visitors.length, garantido acima

      // n rodadas: na rodada r o mandante i recebe o visitante (i + r - 1) mod n.
      // Ao longo das n rodadas cada mandante recebe cada visitante exatamente
      // uma vez, e nenhum time joga duas vezes na mesma rodada.
      for (let r = 1; r <= n; r++) {
        const roundDate = new Date(baseTime + (r - 1) * data.intervalDays * dayMs);
        const dateStr = roundDate.toISOString().slice(0, 10); // YYYY-MM-DD

        for (let i = 0; i < n; i++) {
          const host = hosts[i];
          const visitor = visitors[(i + r - 1) % n];
          const time = (host.home_time ?? DEFAULT_HOME_TIME).slice(0, 8);
          // Fuso explícito: o horário informado pelo mandante é horário de
          // Brasília. Sem o offset o servidor (UTC) gravava 15:00 como 15:00Z,
          // e o jogo aparecia às 12:00 para todo mundo.
          const scheduled = new Date(`${dateStr}T${time}${BRT_OFFSET}`).toISOString();

          matchRows.push({
            competition_id: data.competitionId,
            stage: "group",
            round: r,
            group_label: lado,
            host_team_id: host.id,
            visitor_team_id: visitor.id,
            status: "scheduled",
            scheduled_at: scheduled,
            venue: host.home_venue,
          });
        }
      }
    }

    // Marca o sorteio ANTES de inserir, condicionado a ainda estar nulo. Dois
    // cliques simultâneos no botão só passam por aqui uma vez — antes, os dois
    // passavam e a temporada saía com a tabela dobrada.
    const { data: claimed, error: claimErr } = await supabaseAdmin
      .from("competitions")
      .update({ status: "group_stage", draw_executed_at: new Date().toISOString() })
      .eq("id", data.competitionId)
      .is("draw_executed_at", null)
      .select("id")
      .maybeSingle();
    if (claimErr) throw new Error(claimErr.message);
    if (!claimed) {
      throw new Response(JSON.stringify({ error: "Sorteio já executado" }), { status: 400 });
    }

    const CHUNK = 200;
    try {
      for (let i = 0; i < matchRows.length; i += CHUNK) {
        const { error: mErr } = await supabaseAdmin
          .from("matches")
          .insert(matchRows.slice(i, i + CHUNK));
        if (mErr) throw new Error(mErr.message);
      }
    } catch (err) {
      // Insert parcial deixaria a temporada com meia tabela e o sorteio
      // marcado como feito. Desfaz tudo para o admin poder tentar de novo.
      await supabaseAdmin
        .from("matches")
        .delete()
        .eq("competition_id", data.competitionId)
        .eq("stage", "group");
      await supabaseAdmin
        .from("competitions")
        .update({ status: "registration", draw_executed_at: null })
        .eq("id", data.competitionId);
      throw err;
    }

    return {
      success: true,
      lados: activeSides.length,
      rodadas_por_lado: Object.fromEntries(
        activeSides.map((lado) => [lado, buckets[`host-${lado}`].length]),
      ),
      matches_created: matchRows.length,
      matches_per_lado: matchRows.length / activeSides.length,
    };
  });
