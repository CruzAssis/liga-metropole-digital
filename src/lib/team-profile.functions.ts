import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const slugSchema = z.object({ slug: z.string().min(1).max(120) });

// Public profile (no auth required — uses admin client but only returns safe fields)
export const getTeamPublicProfile = createServerFn({ method: "GET" })
  .inputValidator((input) => slugSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: team, error } = await supabaseAdmin
      .from("teams")
      .select("id, name, short_name, slug, logo_url, banner_url, primary_color, registration_type, status, lado, serie, home_venue, home_time, created_at")
      .eq("slug", data.slug)
      .eq("status", "approved")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!team) return null;

    const { count: supporterCount } = await supabaseAdmin
      .from("team_supporters")
      .select("user_id", { count: "exact", head: true })
      .eq("team_id", team.id);

    const [{ data: athletes }, { data: matches }, { data: groupTeams }] = await Promise.all([
      supabaseAdmin
        .from("athletes")
        .select("id, full_name, nickname, position, photo_url, verified")
        .eq("team_id", team.id)
        .order("full_name"),
      supabaseAdmin
        .from("matches")
        .select(
          "id, stage, round, group_label, host_team_id, visitor_team_id, host_score, visitor_score, status, scheduled_at, venue",
        )
        .or(`host_team_id.eq.${team.id},visitor_team_id.eq.${team.id}`)
        .order("scheduled_at", { ascending: true, nullsFirst: false })
        .limit(100),
      supabaseAdmin
        .from("group_teams")
        .select("group_id, groups!inner(label, team_role, competition_id)")
        .eq("team_id", team.id),
    ]);

    // Hydrate opposing team names
    const ids = Array.from(
      new Set((matches ?? []).flatMap((m) => [m.host_team_id, m.visitor_team_id])),
    );
    const { data: teamsLite } = ids.length
      ? await supabaseAdmin
          .from("teams")
          .select("id, name, short_name, slug, logo_url")
          .in("id", ids)
      : { data: [] as { id: string; name: string; short_name: string; slug: string | null; logo_url: string | null }[] };
    const teamMap: Record<string, { name: string; short_name: string; slug: string | null; logo_url: string | null }> = {};
    for (const t of teamsLite ?? []) teamMap[t.id] = t;

    const groupLabel = groupTeams?.[0]?.groups?.label ?? null;

    return {
      team,
      groupLabel,
      supporterCount: supporterCount ?? 0,
      athletes: athletes ?? [],
      matches: (matches ?? []).map((m) => ({
        ...m,
        host: teamMap[m.host_team_id] ?? null,
        visitor: teamMap[m.visitor_team_id] ?? null,
        is_host: m.host_team_id === team.id,
      })),
    };
  });

// Contact info — only authenticated users can see director's WhatsApp/e-mail
export const getTeamContact = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => slugSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: team } = await supabaseAdmin
      .from("teams")
      .select("id, manager_id")
      .eq("slug", data.slug)
      .eq("status", "approved")
      .maybeSingle();
    if (!team) return null;

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, phone")
      .eq("id", team.manager_id)
      .maybeSingle();

    // Fetch e-mail via auth admin
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(team.manager_id);

    return {
      full_name: profile?.full_name ?? null,
      phone: profile?.phone ?? null,
      email: authUser?.user?.email ?? null,
    };
  });
