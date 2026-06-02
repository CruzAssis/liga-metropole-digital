import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const hex = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .optional()
  .nullable();

const schema = z.object({
  name: z.string().min(2).max(80),
  short_name: z.string().min(1).max(8).optional(),
  registration_type: z.enum(["host", "visitor"]),
  home_venue: z.string().max(255).optional().nullable(),
  home_time: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/)
    .optional()
    .nullable(),
  primary_color: hex,
  secondary_color: hex,
  tertiary_color: hex,
});

function makeShortName(name: string) {
  const clean = name
    .trim()
    .replace(/[^a-zA-ZÀ-ÿ\s]/g, "")
    .toUpperCase();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0] + (words[2]?.[0] ?? "")).slice(0, 4);
  }
  return clean.replace(/\s/g, "").slice(0, 4) || "TIME";
}

export const createTeamRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => schema.parse(input))
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const short_name = data.short_name?.trim() || makeShortName(data.name);

    if (data.registration_type === "host" && !data.home_venue?.trim()) {
      throw new Error("Mandante precisa informar o endereço do campo");
    }

    const { data: team, error: teamErr } = await supabaseAdmin
      .from("teams")
      .insert({
        name: data.name.trim(),
        short_name,
        manager_id: userId,
        registration_type: data.registration_type,
        status: "pending",
        lado: "A",
        serie: "A",
        home_venue: data.home_venue?.trim() || null,
        home_time: data.registration_type === "host" ? data.home_time || null : null,
        primary_color: data.primary_color || null,
        secondary_color: data.secondary_color || null,
        tertiary_color: data.tertiary_color || null,
      } as never)
      .select("id")
      .single();
    if (teamErr || !team) {
      throw new Error(teamErr?.message ?? "Erro ao criar time");
    }

    const { error: memberErr } = await supabaseAdmin
      .from("team_members")
      .insert({
        team_id: team.id,
        user_id: userId,
        role: "director",
        accepted_at: new Date().toISOString(),
      });
    if (memberErr) throw new Error(memberErr.message);

    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: "director" });
    if (roleErr && !roleErr.message.toLowerCase().includes("duplicate")) {
      throw new Error(roleErr.message);
    }

    return { team_id: team.id };
  });
