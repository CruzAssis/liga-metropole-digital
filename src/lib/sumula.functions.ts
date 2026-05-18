import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Match status lifecycle:
//   scheduled -> awaiting_confirmation -> confirmed
//                                      -> disputed
//   scheduled / awaiting_confirmation -> wo (admin)
//   scheduled                         -> live (optional, not used here)

// =============================================================
// List matches involving the manager's team (for /minha-conta)
// =============================================================
export const listMyTeamMatches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;

    const { data: team } = await supabaseAdmin
      .from("teams")
      .select("id, name")
      .eq("manager_id", userId)
      .maybeSingle();
    if (!team) return { team: null, matches: [] };

    const { data: matches, error } = await supabaseAdmin
      .from("matches")
      .select(
        "id, stage, round, group_label, host_team_id, visitor_team_id, host_score, visitor_score, status, scheduled_at, venue, host_filled_at, visitor_confirmed_at",
      )
      .or(`host_team_id.eq.${team.id},visitor_team_id.eq.${team.id}`)
      .order("scheduled_at", { ascending: true, nullsFirst: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const ids = Array.from(
      new Set((matches ?? []).flatMap((m) => [m.host_team_id, m.visitor_team_id])),
    );
    const { data: teams } = await supabaseAdmin
      .from("teams")
      .select("id, name, short_name, logo_url")
      .in("id", ids);
    const map: Record<string, { name: string; short_name: string; logo_url: string | null }> = {};
    for (const t of teams ?? []) map[t.id] = t;

    return {
      team,
      matches: (matches ?? []).map((m) => ({
        ...m,
        host: map[m.host_team_id] ?? null,
        visitor: map[m.visitor_team_id] ?? null,
        is_host: m.host_team_id === team.id,
      })),
    };
  });

// =============================================================
// Fill score (mandante)
// =============================================================
const fillSchema = z.object({
  matchId: z.string().uuid(),
  hostScore: z.number().int().min(0).max(50),
  visitorScore: z.number().int().min(0).max(50),
});

export const fillSumula = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => fillSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: match, error: mErr } = await supabaseAdmin
      .from("matches")
      .select("id, status, host_team_id")
      .eq("id", data.matchId)
      .maybeSingle();
    if (mErr) throw new Error(mErr.message);
    if (!match) throw new Response("Jogo não encontrado", { status: 404 });
    if (!["scheduled", "awaiting_confirmation"].includes(match.status)) {
      throw new Response(JSON.stringify({ error: "Jogo já encerrado" }), { status: 400 });
    }

    const { data: team } = await supabaseAdmin
      .from("teams")
      .select("id")
      .eq("id", match.host_team_id)
      .eq("manager_id", userId)
      .maybeSingle();
    if (!team) {
      throw new Response(
        JSON.stringify({ error: "Apenas o mandante pode preencher a súmula" }),
        { status: 403 },
      );
    }

    const { error: updErr } = await supabaseAdmin
      .from("matches")
      .update({
        host_score: data.hostScore,
        visitor_score: data.visitorScore,
        status: "awaiting_confirmation",
        host_filled_at: new Date().toISOString(),
        visitor_confirmed_at: null,
      })
      .eq("id", data.matchId);
    if (updErr) throw new Error(updErr.message);

    return { success: true };
  });

// =============================================================
// Confirm (visitante)
// =============================================================
const idSchema = z.object({ matchId: z.string().uuid() });

export const confirmSumula = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => idSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: match } = await supabaseAdmin
      .from("matches")
      .select("id, status, visitor_team_id")
      .eq("id", data.matchId)
      .maybeSingle();
    if (!match) throw new Response("Jogo não encontrado", { status: 404 });
    if (match.status !== "awaiting_confirmation") {
      throw new Response(JSON.stringify({ error: "Súmula não está aguardando confirmação" }), {
        status: 400,
      });
    }

    const { data: team } = await supabaseAdmin
      .from("teams")
      .select("id")
      .eq("id", match.visitor_team_id)
      .eq("manager_id", userId)
      .maybeSingle();
    if (!team) {
      throw new Response(JSON.stringify({ error: "Apenas o visitante pode confirmar" }), {
        status: 403,
      });
    }

    const { error: updErr } = await supabaseAdmin
      .from("matches")
      .update({ status: "confirmed", visitor_confirmed_at: new Date().toISOString() })
      .eq("id", data.matchId);
    if (updErr) throw new Error(updErr.message);

    return { success: true };
  });

// =============================================================
// Dispute (visitante)
// =============================================================
export const disputeSumula = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => idSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: match } = await supabaseAdmin
      .from("matches")
      .select("id, status, visitor_team_id")
      .eq("id", data.matchId)
      .maybeSingle();
    if (!match) throw new Response("Jogo não encontrado", { status: 404 });
    if (match.status !== "awaiting_confirmation") {
      throw new Response(JSON.stringify({ error: "Súmula não pode ser contestada agora" }), {
        status: 400,
      });
    }

    const { data: team } = await supabaseAdmin
      .from("teams")
      .select("id")
      .eq("id", match.visitor_team_id)
      .eq("manager_id", userId)
      .maybeSingle();
    if (!team) {
      throw new Response(JSON.stringify({ error: "Apenas o visitante pode contestar" }), {
        status: 403,
      });
    }

    const { error: updErr } = await supabaseAdmin
      .from("matches")
      .update({ status: "disputed" })
      .eq("id", data.matchId);
    if (updErr) throw new Error(updErr.message);

    return { success: true };
  });

// =============================================================
// Admin: list matches needing attention
// =============================================================
async function requireAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Response(JSON.stringify({ error: "Apenas admin" }), { status: 403 });
}

export const adminListSumulasPending = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);

    const { data: matches, error } = await supabaseAdmin
      .from("matches")
      .select(
        "id, stage, round, group_label, host_team_id, visitor_team_id, host_score, visitor_score, status, scheduled_at, venue, host_filled_at, visitor_confirmed_at",
      )
      .in("status", ["awaiting_confirmation", "disputed", "scheduled"])
      .order("scheduled_at", { ascending: true, nullsFirst: false })
      .limit(500);
    if (error) throw new Error(error.message);

    const ids = Array.from(
      new Set((matches ?? []).flatMap((m) => [m.host_team_id, m.visitor_team_id])),
    );
    const { data: teams } = await supabaseAdmin
      .from("teams")
      .select("id, name, short_name")
      .in("id", ids);
    const map: Record<string, { name: string; short_name: string }> = {};
    for (const t of teams ?? []) map[t.id] = t;

    return {
      matches: (matches ?? []).map((m) => ({
        ...m,
        host: map[m.host_team_id] ?? null,
        visitor: map[m.visitor_team_id] ?? null,
      })),
    };
  });

// =============================================================
// Admin: apply WO (3x0 to winner)
// =============================================================
const woSchema = z.object({
  matchId: z.string().uuid(),
  winner: z.enum(["host", "visitor"]),
});

export const adminApplyWO = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => woSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);

    const hostScore = data.winner === "host" ? 3 : 0;
    const visitorScore = data.winner === "visitor" ? 3 : 0;

    const { error } = await supabaseAdmin
      .from("matches")
      .update({
        host_score: hostScore,
        visitor_score: visitorScore,
        status: "wo",
      })
      .eq("id", data.matchId);
    if (error) throw new Error(error.message);

    return { success: true };
  });

// =============================================================
// Admin: force confirm (resolve dispute / auto-confirm expired)
// =============================================================
export const adminForceConfirm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => idSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);

    const { data: match } = await supabaseAdmin
      .from("matches")
      .select("id, status, host_score, visitor_score")
      .eq("id", data.matchId)
      .maybeSingle();
    if (!match) throw new Response("Jogo não encontrado", { status: 404 });
    if (match.host_score == null || match.visitor_score == null) {
      throw new Response(JSON.stringify({ error: "Placar não foi preenchido" }), { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("matches")
      .update({ status: "confirmed", visitor_confirmed_at: new Date().toISOString() })
      .eq("id", data.matchId);
    if (error) throw new Error(error.message);

    return { success: true };
  });
