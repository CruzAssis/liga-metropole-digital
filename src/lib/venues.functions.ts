import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { logAudit } from "@/lib/audit.server";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Response("Forbidden", { status: 403 });
}

export type VenueRow = {
  id: string;
  name: string;
  address: string | null;
  subprefeitura: string | null;
  bairro: string | null;
  lado: "A" | "B" | null;
  maps_link: string | null;
  photo_url: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

// Public list of venues (active only) — safe for anon reads.
export const listPublicVenues = createServerFn({ method: "GET" }).handler(async (): Promise<VenueRow[]> => {
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
  const { data, error } = await supabase
    .from("venues")
    .select("id, name, address, subprefeitura, bairro, lado, maps_link, photo_url, notes, active, created_at, updated_at")
    .eq("active", true)
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as VenueRow[];
});

// Admin listing (includes inactive).
export const adminListVenues = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<VenueRow[]> => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("venues")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as VenueRow[];
  });

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(120),
  address: z.string().trim().max(240).optional().nullable(),
  subprefeitura: z.string().trim().max(80).optional().nullable(),
  bairro: z.string().trim().max(80).optional().nullable(),
  lado: z.enum(["A", "B"]).optional().nullable(),
  maps_link: z.string().trim().url().max(500).optional().nullable().or(z.literal("")),
  photo_url: z.string().trim().url().max(500).optional().nullable().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().nullable(),
  active: z.boolean().optional(),
});

export const adminUpsertVenue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => upsertSchema.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: any = {
      name: data.name,
      address: data.address || null,
      subprefeitura: data.subprefeitura || null,
      bairro: data.bairro || null,
      lado: data.lado || null,
      maps_link: data.maps_link || null,
      photo_url: data.photo_url || null,
      notes: data.notes || null,
      active: data.active ?? true,
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("venues").update(patch).eq("id", data.id);
      if (error) throw new Error(error.message);
      await logAudit({
        claims: context.claims,
        action: "venue.upsert",
        entity_type: "venue",
        entity_id: data.id,
        metadata: { name: data.name, op: "update" },
      });
      return { success: true, id: data.id };
    }
    const { data: inserted, error } = await supabaseAdmin
      .from("venues")
      .insert(patch)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await logAudit({
      claims: context.claims,
      action: "venue.upsert",
      entity_type: "venue",
      entity_id: inserted.id,
      metadata: { name: data.name, op: "insert" },
    });
    return { success: true, id: inserted.id };
  });

export const adminDeleteVenue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("venues").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAudit({
      claims: context.claims,
      action: "venue.delete",
      entity_type: "venue",
      entity_id: data.id,
    });
    return { success: true };
  });
