import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAudit } from "@/lib/audit.server";

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

// ─── Update team mando (registration_type + home venue) ───────────────────────
const mandoSchema = z.object({
  team_id: z.string().uuid(),
  registration_type: z.enum(["host", "visitor"]),
  home_venue: z.string().max(120).nullable().optional(),
  home_time: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/)
    .nullable()
    .optional(),
});

export const updateTeamMando = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => mandoSchema.parse(input))
  .handler(async ({ data, context }) => {
    // Verify caller is manager or director of this team
    const { data: team, error: teamErr } = await context.supabase
      .from("teams")
      .select("id, manager_id, registration_type, status, competition_id")
      .eq("id", data.team_id)
      .maybeSingle();
    if (teamErr) throw new Error(teamErr.message);
    if (!team) throw new Error("Time não encontrado ou você não tem permissão.");

    const newType = data.registration_type;
    const typeChanged = team.registration_type !== newType;

    if (newType === "host" && !data.home_venue?.trim()) {
      throw new Error("Informe o endereço/estádio para times mandantes.");
    }

    let nextStatus: "approved" | "waitlist" | "pending" | "rejected" =
      (team.status as "approved" | "waitlist" | "pending" | "rejected") ?? "pending";

    if (typeChanged) {
      // Enforce competition slot limits when a liga is linked
      if (team.competition_id) {
        const { data: comp } = await supabaseAdmin
          .from("competitions")
          .select("id, host_slots, visitor_slots, max_teams, registration_status")
          .eq("id", team.competition_id)
          .single();
        if (!comp) throw new Error("Liga vinculada não encontrada.");

        const slotsForType = newType === "host" ? comp.host_slots : comp.visitor_slots;

        const { count: approvedOfType } = await supabaseAdmin
          .from("teams")
          .select("id", { count: "exact", head: true })
          .eq("competition_id", team.competition_id)
          .eq("registration_type", newType)
          .eq("status", "approved")
          .neq("id", team.id);

        if ((approvedOfType ?? 0) >= slotsForType) {
          throw new Error(
            `Sem vagas para ${newType === "host" ? "Mandantes" : "Visitantes"} nesta liga (${slotsForType}/${slotsForType} preenchidas). Escolha o outro tipo de mando.`,
          );
        }
      }

      // Global cap (system-level, when master registration is open)
      const { data: settings } = await supabaseAdmin
        .from("system_settings")
        .select("host_slots_limit")
        .eq("id", true)
        .maybeSingle();
      const globalLimit =
        (settings as { host_slots_limit?: number } | null)?.host_slots_limit ?? 40;

      const { count: globalApproved } = await supabaseAdmin
        .from("teams")
        .select("id", { count: "exact", head: true })
        .eq("registration_type", newType)
        .eq("status", "approved")
        .neq("id", team.id);

      if (team.status === "approved") {
        // Keep approved if there is still room globally
        nextStatus = (globalApproved ?? 0) >= globalLimit ? "waitlist" : "approved";
      } else if (team.status === "waitlist" || team.status === "pending") {
        // If a spot exists for the new type globally, keep pending review;
        // if globally full, remain waitlist.
        nextStatus = (globalApproved ?? 0) >= globalLimit ? "waitlist" : team.status;
      }
    }

    const { error: updErr } = await supabaseAdmin
      .from("teams")
      .update({
        registration_type: newType,
        home_venue: data.home_venue?.trim() || null,
        home_time: newType === "host" ? data.home_time || null : null,
        status: nextStatus,
      })
      .eq("id", team.id);
    if (updErr) throw new Error(updErr.message);

    return { ok: true, status: nextStatus, registration_type: newType };
  });

// ─── Director self-service: edit team basics ─────────────────────────────────
const directorEditSchema = z.object({
  team_id: z.string().uuid(),
  name: z.string().trim().min(2).max(80),
  short_name: z.string().trim().min(2).max(10),
  lado: z.enum(["A", "B"]),
  registration_type: z.enum(["host", "visitor"]),
  home_venue: z.string().max(120).nullable().optional(),
  home_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
});

export const updateTeamByDirector = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => directorEditSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: team, error: readErr } = await context.supabase
      .from("teams")
      .select("id, manager_id, registration_type, status, competition_id, lado, name, short_name")
      .eq("id", data.team_id)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!team) throw new Error("Time não encontrado ou você não tem permissão.");

    if (data.registration_type === "host" && !data.home_venue?.trim()) {
      throw new Error("Informe o endereço/estádio para times mandantes.");
    }

    const typeChanged = team.registration_type !== data.registration_type;
    let nextStatus = team.status as "approved" | "waitlist" | "pending" | "rejected";

    if (typeChanged) {
      if (team.competition_id) {
        const { data: comp } = await supabaseAdmin
          .from("competitions")
          .select("host_slots, visitor_slots")
          .eq("id", team.competition_id)
          .single();
        if (!comp) throw new Error("Liga vinculada não encontrada.");
        const slotsForType = data.registration_type === "host" ? comp.host_slots : comp.visitor_slots;
        const { count: approvedOfType } = await supabaseAdmin
          .from("teams")
          .select("id", { count: "exact", head: true })
          .eq("competition_id", team.competition_id)
          .eq("registration_type", data.registration_type)
          .eq("status", "approved")
          .neq("id", team.id);
        if ((approvedOfType ?? 0) >= slotsForType) {
          throw new Error(
            `Sem vagas para ${data.registration_type === "host" ? "Mandantes" : "Visitantes"} nesta liga.`,
          );
        }
      }
      const { data: settings } = await supabaseAdmin
        .from("system_settings").select("host_slots_limit").eq("id", true).maybeSingle();
      const globalLimit = (settings as { host_slots_limit?: number } | null)?.host_slots_limit ?? 40;
      const { count: globalApproved } = await supabaseAdmin
        .from("teams").select("id", { count: "exact", head: true })
        .eq("registration_type", data.registration_type).eq("status", "approved").neq("id", team.id);
      if (team.status === "approved") {
        nextStatus = (globalApproved ?? 0) >= globalLimit ? "waitlist" : "approved";
      } else if (team.status === "waitlist" || team.status === "pending") {
        nextStatus = (globalApproved ?? 0) >= globalLimit ? "waitlist" : team.status;
      }
    }

    const { error: updErr } = await context.supabase
      .from("teams")
      .update({
        name: data.name.trim(),
        short_name: data.short_name.trim().toUpperCase(),
        lado: data.lado,
        registration_type: data.registration_type,
        home_venue: data.home_venue?.trim() || null,
        home_time: data.registration_type === "host" ? data.home_time || null : null,
        status: nextStatus,
      })
      .eq("id", team.id);
    if (updErr) throw new Error(updErr.message);

    return { ok: true, status: nextStatus };
  });

// ─── Admin: full edit of any team ────────────────────────────────────────────
const adminEditSchema = z.object({
  team_id: z.string().uuid(),
  name: z.string().trim().min(2).max(80).optional(),
  short_name: z.string().trim().min(2).max(10).optional(),
  lado: z.enum(["A", "B"]).optional(),
  serie: z.enum(["A", "B"]).optional(),
  registration_type: z.enum(["host", "visitor"]).optional(),
  status: z.enum(["pending", "approved", "waitlist", "rejected"]).optional(),
  competition_id: z.string().uuid().nullable().optional(),
  home_venue: z.string().max(120).nullable().optional(),
  home_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
});

export const adminUpdateTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => adminEditSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Apenas administradores podem editar times.");

    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name.trim();
    if (data.short_name !== undefined) patch.short_name = data.short_name.trim().toUpperCase();
    if (data.lado !== undefined) patch.lado = data.lado;
    if (data.serie !== undefined) patch.serie = data.serie;
    if (data.registration_type !== undefined) patch.registration_type = data.registration_type;
    if (data.status !== undefined) patch.status = data.status;
    if (data.competition_id !== undefined) patch.competition_id = data.competition_id;
    if (data.home_venue !== undefined) patch.home_venue = data.home_venue?.trim() || null;
    if (data.home_time !== undefined) patch.home_time = data.home_time || null;

    const { error } = await supabaseAdmin.from("teams").update(patch as never).eq("id", data.team_id);
    if (error) throw new Error(error.message);
    await logAudit({
      claims: context.claims,
      action: "team.update",
      entity_type: "team",
      entity_id: data.team_id,
      metadata: { fields: Object.keys(patch) },
    });
    return { ok: true };
  });

// ─── Admin: delete a team and its dependent data ─────────────────────────────
const adminDeleteSchema = z.object({ team_id: z.string().uuid() });

export const adminDeleteTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => adminDeleteSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Apenas administradores podem excluir times.");

    const teamId = data.team_id;

    // Collect match ids to delete their events/votes first
    const { data: matches } = await supabaseAdmin
      .from("matches")
      .select("id")
      .or(`host_team_id.eq.${teamId},visitor_team_id.eq.${teamId}`);
    const matchIds = (matches ?? []).map((m) => m.id);

    if (matchIds.length) {
      await supabaseAdmin.from("match_events").delete().in("match_id", matchIds);
      await supabaseAdmin.from("match_best_opponent_votes").delete().in("match_id", matchIds);
      await supabaseAdmin.from("matches").delete().in("id", matchIds);
    }

    // Remove team from groups, supporters, members, athletes
    await supabaseAdmin.from("group_teams").delete().eq("team_id", teamId);
    await supabaseAdmin.from("team_supporters").delete().eq("team_id", teamId);
    await supabaseAdmin.from("team_members").delete().eq("team_id", teamId);
    await supabaseAdmin.from("athletes").delete().eq("team_id", teamId);

    const { error } = await supabaseAdmin.from("teams").delete().eq("id", teamId);
    if (error) throw new Error(error.message);

    await logAudit({
      claims: context.claims,
      action: "team.delete",
      entity_type: "team",
      entity_id: teamId,
    });
    return { ok: true };
  });

