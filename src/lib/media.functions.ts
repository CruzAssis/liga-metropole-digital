import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { logAudit } from "@/lib/audit.server";

export type MediaKind = "photo" | "video" | "embed";
export type MediaPlatform = "upload" | "youtube" | "instagram" | "tiktok" | "x" | "other";

export type MediaItem = {
  id: string;
  kind: MediaKind;
  platform: MediaPlatform | null;
  url: string;
  thumbnail_url: string | null;
  title: string | null;
  caption: string | null;
  credit: string | null;
  team_id: string | null;
  match_id: string | null;
  competition_id: string | null;
  round_number: number | null;
  is_featured: boolean;
  is_published: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
  team?: { id: string; name: string; short_name: string | null; logo_url: string | null } | null;
};

async function isAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  return !!data;
}


const listFilterSchema = z
  .object({
    teamId: z.string().uuid().optional(),
    competitionId: z.string().uuid().optional(),
    matchId: z.string().uuid().optional(),
    featuredOnly: z.boolean().optional(),
    limit: z.number().int().min(1).max(200).optional(),
  })
  .optional();

// Public list — published items only.
export const listPublicMedia = createServerFn({ method: "GET" })
  .inputValidator((i) => listFilterSchema.parse(i))
  .handler(async ({ data }): Promise<MediaItem[]> => {
    const { createClient } = await import("@supabase/supabase-js");
    const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
    const supabase = createClient(process.env.SUPABASE_URL!, key, {
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });
    let q = supabase
      .from("media_items")
      .select(
        "id, kind, platform, url, thumbnail_url, title, caption, credit, team_id, match_id, competition_id, round_number, is_featured, is_published, display_order, created_at, updated_at, team:teams(id, name, short_name, logo_url)"
      )
      .eq("is_published", true)
      .order("is_featured", { ascending: false })
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (data?.teamId) q = q.eq("team_id", data.teamId);
    if (data?.competitionId) q = q.eq("competition_id", data.competitionId);
    if (data?.matchId) q = q.eq("match_id", data.matchId);
    if (data?.featuredOnly) q = q.eq("is_featured", true);
    if (data?.limit) q = q.limit(data.limit);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as unknown as MediaItem[];
  });

// Admin list — includes unpublished.
export const adminListMedia = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MediaItem[]> => {
    if (!(await isAdmin(context.supabase, context.userId))) throw new Response("Forbidden", { status: 403 });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("media_items")
      .select(
        "id, kind, platform, url, thumbnail_url, title, caption, credit, team_id, match_id, competition_id, round_number, is_featured, is_published, display_order, created_at, updated_at, team:teams(id, name, short_name, logo_url)"
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as MediaItem[];
  });

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  kind: z.enum(["photo", "video", "embed"]),
  platform: z.enum(["upload", "youtube", "instagram", "tiktok", "x", "other"]).optional().nullable(),
  url: z.string().trim().url().max(1000),
  thumbnail_url: z.string().trim().url().max(1000).optional().nullable().or(z.literal("")),
  title: z.string().trim().max(160).optional().nullable(),
  caption: z.string().trim().max(1000).optional().nullable(),
  credit: z.string().trim().max(160).optional().nullable(),
  team_id: z.string().uuid().optional().nullable(),
  match_id: z.string().uuid().optional().nullable(),
  competition_id: z.string().uuid().optional().nullable(),
  round_number: z.number().int().min(0).max(200).optional().nullable(),
  is_featured: z.boolean().optional(),
  is_published: z.boolean().optional(),
  display_order: z.number().int().min(0).max(9999).optional(),
});

export const upsertMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => upsertSchema.parse(i))
  .handler(async ({ data, context }) => {
    const admin = await isAdmin(context.supabase, context.userId);
    // Directors can only manage rows tied to their team.
    if (!admin) {
      if (!data.team_id) throw new Response("Forbidden", { status: 403 });
      const { data: isDir } = await context.supabase.rpc("is_team_director", {
        _user_id: context.userId,
        _team_id: data.team_id,
      });
      if (!isDir) throw new Response("Forbidden", { status: 403 });
    }
    const patch: any = {
      kind: data.kind,
      platform: data.platform || "upload",
      url: data.url,
      thumbnail_url: data.thumbnail_url || null,
      title: data.title || null,
      caption: data.caption || null,
      credit: data.credit || null,
      team_id: data.team_id || null,
      match_id: data.match_id || null,
      competition_id: data.competition_id || null,
      round_number: data.round_number ?? null,
      is_featured: !!data.is_featured,
      is_published: data.is_published ?? true,
      display_order: data.display_order ?? 0,
    };
    const client = admin
      ? (await import("@/integrations/supabase/client.server")).supabaseAdmin
      : context.supabase;
    if (data.id) {
      const { error } = await client.from("media_items").update(patch).eq("id", data.id);
      if (error) throw new Error(error.message);
      if (admin) {
        await logAudit({
          claims: context.claims,
          action: "media.upsert",
          entity_type: "media_item",
          entity_id: data.id,
          metadata: { op: "update" },
        });
      }
      return { success: true, id: data.id };
    }
    const { data: inserted, error } = await client
      .from("media_items")
      .insert({ ...patch, created_by: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    if (admin) {
      await logAudit({
        claims: context.claims,
        action: "media.upsert",
        entity_type: "media_item",
        entity_id: inserted.id,
        metadata: { op: "insert" },
      });
    }
    return { success: true, id: inserted.id };
  });

export const deleteMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const admin = await isAdmin(context.supabase, context.userId);
    const client = admin
      ? (await import("@/integrations/supabase/client.server")).supabaseAdmin
      : context.supabase;
    const { error } = await client.from("media_items").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    if (admin) {
      await logAudit({
        claims: context.claims,
        action: "media.delete",
        entity_type: "media_item",
        entity_id: data.id,
      });
    }
    return { success: true };
  });
