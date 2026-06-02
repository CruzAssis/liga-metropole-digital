import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const inputSchema = z.object({ competitionId: z.string().uuid() });

const ROUNDS_PER_SIDE = 20; // cada Mandante enfrenta cada Visitante do mesmo Lado uma vez

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
};

/**
 * Sorteio oficial Liga Metrópole Várzea (V6):
 *  - 40 Mandantes + 40 Visitantes, divididos em Lado A e Lado B (20 cada).
 *  - Confrontos APENAS Mandante × Visitante e SOMENTE dentro do mesmo Lado.
 *  - Cada Mandante joga uma vez contra cada Visitante do seu Lado (20 rodadas).
 *  - 20 partidas por rodada por Lado → 400 partidas por Lado → 800 totais.
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

    const { data: teams, error: teamsErr } = await supabaseAdmin
      .from("teams")
      .select("id, registration_type, status, lado")
      .eq("status", "approved");
    if (teamsErr) throw new Error(teamsErr.message);

    const approved = (teams ?? []) as TeamRow[];
    const buckets = {
      "host-A": approved.filter((t) => t.registration_type === "host" && t.lado === "A"),
      "host-B": approved.filter((t) => t.registration_type === "host" && t.lado === "B"),
      "visitor-A": approved.filter((t) => t.registration_type === "visitor" && t.lado === "A"),
      "visitor-B": approved.filter((t) => t.registration_type === "visitor" && t.lado === "B"),
    };

    const expected = 20;
    const counts = {
      "host-A": buckets["host-A"].length,
      "host-B": buckets["host-B"].length,
      "visitor-A": buckets["visitor-A"].length,
      "visitor-B": buckets["visitor-B"].length,
    };
    const wrong = Object.entries(counts).filter(([, n]) => n !== expected);
    if (wrong.length > 0) {
      throw new Response(
        JSON.stringify({
          error: "Cada categoria/lado precisa de exatamente 20 times aprovados",
          counts,
        }),
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
    };
    const matchRows: MatchInsert[] = [];

    for (const lado of ["A", "B"] as const) {
      const hosts = secureShuffle(buckets[`host-${lado}`]);
      const visitors = secureShuffle(buckets[`visitor-${lado}`]);

      // Round-robin cíclico: na rodada r, host[i] joga contra visitor[(i+r-1) % 20]
      for (let r = 1; r <= ROUNDS_PER_SIDE; r++) {
        for (let i = 0; i < expected; i++) {
          matchRows.push({
            competition_id: data.competitionId,
            stage: "group",
            round: r,
            group_label: lado,
            host_team_id: hosts[i].id,
            visitor_team_id: visitors[(i + r - 1) % expected].id,
            status: "scheduled",
          });
        }
      }
    }

    const CHUNK = 200;
    for (let i = 0; i < matchRows.length; i += CHUNK) {
      const { error: mErr } = await supabaseAdmin
        .from("matches")
        .insert(matchRows.slice(i, i + CHUNK));
      if (mErr) throw new Error(mErr.message);
    }

    const { error: updErr } = await supabaseAdmin
      .from("competitions")
      .update({ status: "group_stage", draw_executed_at: new Date().toISOString() })
      .eq("id", data.competitionId);
    if (updErr) throw new Error(updErr.message);

    return {
      success: true,
      lados: 2,
      matches_created: matchRows.length,
      matches_per_lado: matchRows.length / 2,
    };
  });
