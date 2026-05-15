import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const inputSchema = z.object({ competitionId: z.string().uuid() });

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;
// shadow group mapping (mirror): A↔E, B↔F, C↔G, D↔H
const SHADOW: Record<string, string> = {
  A: "E", B: "F", C: "G", D: "H",
  E: "A", F: "B", G: "C", H: "D",
};

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

export const executeDraw = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // a) admin check
    const { data: isAdmin, error: roleErr } = await supabaseAdmin.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) {
      throw new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }

    // b) competition exists & not yet drawn
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

    // c) load approved teams
    const { data: teams, error: teamsErr } = await supabaseAdmin
      .from("teams")
      .select("id, registration_type, status")
      .eq("status", "approved");
    if (teamsErr) throw new Error(teamsErr.message);

    const hostsAll = (teams ?? []).filter((t) => t.registration_type === "host");
    const visitorsAll = (teams ?? []).filter((t) => t.registration_type === "visitor");

    if (hostsAll.length !== 40 || visitorsAll.length !== 40) {
      throw new Response(
        JSON.stringify({
          error: "Aguardando 40 times de cada tipo",
          hosts: hostsAll.length,
          visitors: visitorsAll.length,
        }),
        { status: 400 },
      );
    }

    // d) shuffle
    const hosts = secureShuffle(hostsAll);
    const visitors = secureShuffle(visitorsAll);

    // e) create 16 groups
    const groupRows = LETTERS.flatMap((label) => [
      { competition_id: data.competitionId, label, team_role: "host" },
      { competition_id: data.competitionId, label, team_role: "visitor" },
    ]);
    const { data: groups, error: groupsErr } = await supabaseAdmin
      .from("groups")
      .insert(groupRows)
      .select("id, label, team_role");
    if (groupsErr) throw new Error(groupsErr.message);

    const groupHostByLetter: Record<string, string> = {};
    const groupVisitorByLetter: Record<string, string> = {};
    for (const g of groups!) {
      if (g.team_role === "host") groupHostByLetter[g.label] = g.id;
      else groupVisitorByLetter[g.label] = g.id;
    }

    // f) assign teams (5 per group)
    const groupTeamRows: { group_id: string; team_id: string }[] = [];
    const hostsByLetter: Record<string, typeof hosts> = {};
    const visitorsByLetter: Record<string, typeof visitors> = {};
    for (const l of LETTERS) {
      hostsByLetter[l] = [];
      visitorsByLetter[l] = [];
    }
    for (let i = 0; i < 40; i++) {
      const letter = LETTERS[Math.floor(i / 5)];
      groupTeamRows.push({ group_id: groupHostByLetter[letter], team_id: hosts[i].id });
      groupTeamRows.push({ group_id: groupVisitorByLetter[letter], team_id: visitors[i].id });
      hostsByLetter[letter].push(hosts[i]);
      visitorsByLetter[letter].push(visitors[i]);
    }
    const { error: gtErr } = await supabaseAdmin.from("group_teams").insert(groupTeamRows);
    if (gtErr) throw new Error(gtErr.message);

    // g) generate matches: round-robin cyclic
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

    const buildPairings = (
      M: typeof hosts,
      V: typeof visitors,
      letter: string,
      roundOffset: number,
    ) => {
      for (let r = 0; r < 5; r++) {
        for (let i = 0; i < 5; i++) {
          matchRows.push({
            competition_id: data.competitionId,
            stage: "group",
            round: r + 1 + roundOffset,
            group_label: letter,
            host_team_id: M[i].id,
            visitor_team_id: V[(i + r) % 5].id,
            status: "scheduled",
          });
        }
      }
    };

    // own group: rounds 1-5
    for (const letter of LETTERS) {
      buildPairings(hostsByLetter[letter], visitorsByLetter[letter], letter, 0);
    }
    // shadow group: rounds 6-10
    for (const letter of LETTERS) {
      buildPairings(
        hostsByLetter[letter],
        visitorsByLetter[SHADOW[letter]],
        letter,
        5,
      );
    }

    // chunk insert (matches table)
    const CHUNK = 200;
    for (let i = 0; i < matchRows.length; i += CHUNK) {
      const { error: mErr } = await supabaseAdmin
        .from("matches")
        .insert(matchRows.slice(i, i + CHUNK));
      if (mErr) throw new Error(mErr.message);
    }

    // h) update competition
    const { error: updErr } = await supabaseAdmin
      .from("competitions")
      .update({ status: "group_stage", draw_executed_at: new Date().toISOString() })
      .eq("id", data.competitionId);
    if (updErr) throw new Error(updErr.message);

    // i) result
    return {
      success: true,
      groups_created: groups!.length,
      matches_created: matchRows.length,
    };
  });
