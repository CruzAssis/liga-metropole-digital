import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Response("Forbidden", { status: 403 });
}

export type PublicLeagueConfig = {
  league_name: string | null;
  tagline: string | null;
  season: string | null;
  whatsapp: string | null;
  rules_url: string | null;
  format_description: string | null;
  instagram: string | null;
  contact_email: string | null;
};

// Public read via SECURITY DEFINER RPC — safe for anon.
export const getPublicLeagueConfig = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicLeagueConfig | null> => {
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
    const { data, error } = await supabase.rpc("get_public_league_config");
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    return (row ?? null) as PublicLeagueConfig | null;
  },
);

const configSchema = z.object({
  public_league_name: z.string().trim().max(80).optional().nullable(),
  public_tagline: z.string().trim().max(160).optional().nullable(),
  public_season: z.string().trim().max(40).optional().nullable(),
  public_whatsapp: z.string().trim().max(30).optional().nullable(),
  public_rules_url: z.string().trim().max(500).optional().nullable().or(z.literal("")),
  public_format_description: z.string().trim().max(2000).optional().nullable(),
  public_instagram: z.string().trim().max(80).optional().nullable(),
  public_contact_email: z.string().trim().max(120).optional().nullable(),
});

export const adminGetLeagueConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("system_settings")
      .select(
        "public_league_name, public_tagline, public_season, public_whatsapp, public_rules_url, public_format_description, public_instagram, public_contact_email",
      )
      .eq("id", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? {};
  });

export const adminSaveLeagueConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => configSchema.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: any = {
      public_league_name: data.public_league_name || null,
      public_tagline: data.public_tagline || null,
      public_season: data.public_season || null,
      public_whatsapp: data.public_whatsapp || null,
      public_rules_url: data.public_rules_url || null,
      public_format_description: data.public_format_description || null,
      public_instagram: data.public_instagram || null,
      public_contact_email: data.public_contact_email || null,
      updated_by: context.userId,
    };
    const { error } = await supabaseAdmin.from("system_settings").update(patch).eq("id", true);
    if (error) throw new Error(error.message);
    return { success: true };
  });
