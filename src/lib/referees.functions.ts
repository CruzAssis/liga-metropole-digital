import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { logAudit } from "@/lib/audit.server";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Response("Forbidden", { status: 403 });
}

export type RefereeRow = {
  id: string;
  full_name: string;
  nickname: string | null;
  whatsapp: string | null;
  city: string | null;
  photo_url: string | null;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type RefereeWithStats = RefereeRow & {
  avg_rating: number;
  total_ratings: number;
  total_matches: number;
};

async function publicClient() {
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient(process.env.SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input: any, init: any) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

// Public: list active referees with aggregate stats.
export const listPublicReferees = createServerFn({ method: "GET" }).handler(
  async (): Promise<RefereeWithStats[]> => {
    const supabase = await publicClient();
    const { data, error } = await supabase
      .from("referees")
      .select("id, full_name, nickname, whatsapp, city, photo_url, active, notes, created_at, updated_at")
      .eq("active", true)
      .order("full_name");
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as RefereeRow[];
    // Aggregate via service role for public read of counts/avg (safe, non-PII).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const out: RefereeWithStats[] = [];
    for (const r of rows) {
      const [{ count: matches }, { data: ratings }] = await Promise.all([
        supabaseAdmin.from("match_referees").select("id", { count: "exact", head: true }).eq("referee_id", r.id),
        supabaseAdmin.from("referee_ratings").select("rating").eq("referee_id", r.id),
      ]);
      const list = (ratings ?? []) as { rating: number }[];
      const avg = list.length ? list.reduce((s, x) => s + x.rating, 0) / list.length : 0;
      out.push({
        ...r,
        total_matches: matches ?? 0,
        total_ratings: list.length,
        avg_rating: Math.round(avg * 100) / 100,
      });
    }
    return out;
  },
);

// Admin: list all referees (with inactive).
export const adminListReferees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RefereeRow[]> => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("referees").select("*").order("full_name");
    if (error) throw new Error(error.message);
    return (data ?? []) as RefereeRow[];
  });

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  full_name: z.string().trim().min(2).max(120),
  nickname: z.string().trim().max(60).optional().nullable(),
  whatsapp: z.string().trim().max(30).optional().nullable(),
  city: z.string().trim().max(80).optional().nullable(),
  photo_url: z.string().trim().max(500).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  active: z.boolean().optional(),
});

export const adminUpsertReferee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => upsertSchema.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: any = {
      full_name: data.full_name,
      nickname: data.nickname || null,
      whatsapp: data.whatsapp || null,
      city: data.city || null,
      photo_url: data.photo_url || null,
      notes: data.notes || null,
      active: data.active ?? true,
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("referees").update(patch).eq("id", data.id);
      if (error) throw new Error(error.message);
      await logAudit({
        claims: context.claims,
        action: "referee.upsert",
        entity_type: "referee",
        entity_id: data.id,
        metadata: { op: "update", name: data.full_name },
      });
      return { success: true, id: data.id };
    }
    const { data: inserted, error } = await supabaseAdmin
      .from("referees")
      .insert(patch)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await logAudit({
      claims: context.claims,
      action: "referee.upsert",
      entity_type: "referee",
      entity_id: inserted.id,
      metadata: { op: "insert", name: data.full_name },
    });
    return { success: true, id: inserted.id };
  });

export const adminDeleteReferee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("referees").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAudit({
      claims: context.claims,
      action: "referee.delete",
      entity_type: "referee",
      entity_id: data.id,
    });
    return { success: true };
  });

// --- Assignments (escala) ---

export type MatchAssignmentRow = {
  id: string;
  match_id: string;
  referee_id: string;
  role: string;
  referee: { full_name: string; nickname: string | null; photo_url: string | null };
};

export const adminListAssignments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ match_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<MatchAssignmentRow[]> => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("match_referees")
      .select("id, match_id, referee_id, role, referees(full_name, nickname, photo_url)")
      .eq("match_id", data.match_id)
      .order("role");
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.id,
      match_id: r.match_id,
      referee_id: r.referee_id,
      role: r.role,
      referee: r.referees,
    }));
  });

export const adminAssignReferee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        match_id: z.string().uuid(),
        referee_id: z.string().uuid(),
        role: z.enum(["principal", "assistente_1", "assistente_2", "mesa", "reserva"]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Replace any existing assignment for this (match, role) to keep uniqueness clean.
    await supabaseAdmin.from("match_referees").delete().eq("match_id", data.match_id).eq("role", data.role);
    const { error } = await supabaseAdmin.from("match_referees").insert({
      match_id: data.match_id,
      referee_id: data.referee_id,
      role: data.role,
    });
    if (error) throw new Error(error.message);
    await logAudit({
      claims: context.claims,
      action: "referee.assign",
      entity_type: "match_referee",
      entity_id: data.match_id,
      metadata: { referee_id: data.referee_id, role: data.role },
    });
    return { success: true };
  });

export const adminRemoveAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("match_referees").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { success: true };
  });

// --- Director view: my matches with assigned referees + my ratings ---

export type DirectorMatchAssignment = {
  match_id: string;
  scheduled_at: string | null;
  status: string;
  host_team_id: string;
  visitor_team_id: string;
  host_name: string;
  visitor_name: string;
  assignments: {
    referee_id: string;
    role: string;
    full_name: string;
    nickname: string | null;
    photo_url: string | null;
    my_rating: number | null;
    my_comment: string | null;
    my_rating_at: string | null;
    editable: boolean;
  }[];
};

export const listDirectorMatchesWithReferees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DirectorMatchAssignment[]> => {
    const { supabase, userId } = context;
    const { data: teamRows } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("user_id", userId)
      .eq("role", "director")
      .not("accepted_at", "is", null);
    const teamIds = (teamRows ?? []).map((r: any) => r.team_id);
    if (teamIds.length === 0) return [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: matches, error } = await supabaseAdmin
      .from("matches")
      .select(
        "id, scheduled_at, status, host_team_id, visitor_team_id, host:teams!matches_host_team_id_fkey(name), visitor:teams!matches_visitor_team_id_fkey(name), match_referees(id, referee_id, role, referees(full_name, nickname, photo_url))",
      )
      .in("status", ["confirmed", "closed", "wo"])
      .or(`host_team_id.in.(${teamIds.join(",")}),visitor_team_id.in.(${teamIds.join(",")})`)
      .order("scheduled_at", { ascending: false })
      .limit(120);
    if (error) throw new Error(error.message);
    const { data: myRatings } = await supabaseAdmin
      .from("referee_ratings")
      .select("match_id, referee_id, rating, comment, updated_at")
      .eq("rater_user_id", userId);
    const ratingMap = new Map<string, { rating: number; comment: string | null; updated_at: string }>();
    for (const r of myRatings ?? []) ratingMap.set(`${r.match_id}:${r.referee_id}`, r as any);
    return (matches ?? [])
      .filter((m: any) => (m.match_referees ?? []).length > 0)
      .map((m: any) => {
        const editable = m.status !== "closed";
        return {
          match_id: m.id,
          scheduled_at: m.scheduled_at,
          status: m.status,
          host_team_id: m.host_team_id,
          visitor_team_id: m.visitor_team_id,
          host_name: m.host?.name ?? "—",
          visitor_name: m.visitor?.name ?? "—",
          assignments: (m.match_referees ?? []).map((a: any) => {
            const mine = ratingMap.get(`${m.id}:${a.referee_id}`) ?? null;
            return {
              referee_id: a.referee_id,
              role: a.role,
              full_name: a.referees?.full_name ?? "—",
              nickname: a.referees?.nickname ?? null,
              photo_url: a.referees?.photo_url ?? null,
              my_rating: mine?.rating ?? null,
              my_comment: mine?.comment ?? null,
              my_rating_at: mine?.updated_at ?? null,
              editable,
            };
          }),
        };
      });
  });

export const rateReferee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        match_id: z.string().uuid(),
        referee_id: z.string().uuid(),
        rating: z.number().int().min(1).max(5),
        comment: z.string().trim().max(500).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // confirm caller directs one of the teams in the match
    const { data: match, error: mErr } = await supabase
      .from("matches")
      .select("host_team_id, visitor_team_id, status")
      .eq("id", data.match_id)
      .maybeSingle();
    if (mErr) throw new Error(mErr.message);
    if (!match) throw new Response("Partida não encontrada", { status: 404 });
    if (match.status === "closed") {
      throw new Response("Partida encerrada: avaliação bloqueada", { status: 403 });
    }
    const [{ data: isHostDir }, { data: isVisDir }] = await Promise.all([
      supabase.rpc("is_team_director", { _user_id: userId, _team_id: match.host_team_id }),
      supabase.rpc("is_team_director", { _user_id: userId, _team_id: match.visitor_team_id }),
    ]);
    if (!isHostDir && !isVisDir) throw new Response("Somente diretores das equipes podem avaliar", { status: 403 });
    const teamId = isHostDir ? match.host_team_id : match.visitor_team_id;
    // Upsert (rater_user_id + match + referee is unique).
    const { error } = await supabase.from("referee_ratings").upsert(
      {
        match_id: data.match_id,
        referee_id: data.referee_id,
        rater_user_id: userId,
        team_id: teamId,
        rating: data.rating,
        comment: data.comment || null,
      } as any,
      { onConflict: "match_id,referee_id,rater_user_id" },
    );
    if (error) throw new Error(error.message);
    return { success: true };
  });
