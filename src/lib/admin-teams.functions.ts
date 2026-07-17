import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdminTeamRow = {
  id: string;
  name: string;
  short_name: string | null;
  logo_url: string | null;
  status: string;
  registration_type: string | null;
  home_venue: string | null;
  created_at: string;
  director_name: string | null;
  director_phone: string | null;
};

export const listAdminTeams = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminTeamRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { data: teams, error } = await supabaseAdmin
      .from("teams")
      .select("id, name, short_name, logo_url, status, registration_type, home_venue, created_at, manager_id")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const managerIds = Array.from(new Set((teams ?? []).map((t) => t.manager_id).filter(Boolean))) as string[];
    const { data: profiles } = managerIds.length
      ? await supabaseAdmin.from("profiles").select("id, full_name, phone").in("id", managerIds)
      : { data: [] };
    const pMap = new Map<string, { full_name: string | null; phone: string | null }>();
    for (const p of profiles ?? []) pMap.set(p.id, { full_name: p.full_name, phone: p.phone });

    return (teams ?? []).map((t) => {
      const p = t.manager_id ? pMap.get(t.manager_id) : undefined;
      return {
        id: t.id,
        name: t.name,
        short_name: t.short_name,
        logo_url: t.logo_url,
        status: t.status,
        registration_type: t.registration_type,
        home_venue: t.home_venue,
        created_at: t.created_at,
        director_name: p?.full_name ?? null,
        director_phone: p?.phone ?? null,
      };
    });
  });
