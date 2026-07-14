import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  invite_code: z.string().trim().min(4).max(16),
});

// Public lookup: returns basic team info by invite code, no auth needed.
export const lookupInvite = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("get_team_by_invite_code", {
      _code: data.invite_code.toUpperCase(),
    });
    if (error) throw new Error(error.message);
    const team = Array.isArray(rows) ? rows[0] : rows;
    if (!team) return { found: false as const };
    return { found: true as const, team };
  });

// Authenticated: adds the current user as a player to the team.
export const joinTeamByInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: rows, error: lookupErr } = await supabaseAdmin.rpc(
      "get_team_by_invite_code",
      { _code: data.invite_code.toUpperCase() },
    );
    if (lookupErr) throw new Error(lookupErr.message);
    const team = Array.isArray(rows) ? rows[0] : rows;
    if (!team) throw new Error("Código de convite inválido");

    // Already a member?
    const { data: existing } = await supabaseAdmin
      .from("team_members")
      .select("id, accepted_at")
      .eq("team_id", team.id)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      if (!existing.accepted_at) {
        await supabaseAdmin
          .from("team_members")
          .update({ accepted_at: new Date().toISOString() })
          .eq("id", existing.id);
      }
      return { team_id: team.id, team_name: team.name, already_member: true };
    }

    const { error: memberErr } = await supabaseAdmin.from("team_members").insert({
      team_id: team.id,
      user_id: userId,
      role: "player",
      accepted_at: new Date().toISOString(),
    });
    if (memberErr) throw new Error(memberErr.message);

    // Ensure the user has the player role
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "player" }, { onConflict: "user_id,role", ignoreDuplicates: true });
    if (roleErr && !roleErr.message.toLowerCase().includes("duplicate")) {
      throw new Error(roleErr.message);
    }

    return { team_id: team.id, team_name: team.name, already_member: false };
  });
