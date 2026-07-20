import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAudit } from "@/lib/audit.server";

async function assertCallerIsAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Apenas administradores podem executar esta ação");
}

export type AdminUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  cpf_masked: string | null;
  created_at: string;
  roles: ("admin" | "director")[];
};

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ users: AdminUser[] }> => {
    await assertCallerIsAdmin(context.userId);

    const { data: authList, error: authErr } =
      await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (authErr) throw new Error(authErr.message);

    const ids = authList.users.map((u) => u.id);

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, cpf")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

    const profileMap = new Map(profiles?.map((p) => [p.id, p]) ?? []);
    const rolesMap = new Map<string, ("admin" | "director")[]>();
    for (const r of roles ?? []) {
      const arr = rolesMap.get(r.user_id) ?? [];
      arr.push(r.role as "admin" | "director");
      rolesMap.set(r.user_id, arr);
    }

    const users: AdminUser[] = authList.users.map((u) => {
      const profile = profileMap.get(u.id);
      const cpf = profile?.cpf ?? null;
      const cpf_masked = cpf && cpf.length >= 4
        ? `***.***.***-${cpf.slice(-2)}`
        : null;
      return {
        id: u.id,
        email: u.email ?? null,
        full_name: profile?.full_name ?? null,
        cpf_masked,
        created_at: u.created_at,
        roles: rolesMap.get(u.id) ?? [],
      };
    });

    users.sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));
    return { users };
  });

const setRoleSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(["admin", "director"]),
  enabled: z.boolean(),
});

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => setRoleSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertCallerIsAdmin(context.userId);

    // Anti-lockout: can't remove the last admin
    if (data.role === "admin" && !data.enabled) {
      const { count } = await supabaseAdmin
        .from("user_roles")
        .select("user_id", { count: "exact", head: true })
        .eq("role", "admin");
      if ((count ?? 0) <= 1) {
        throw new Error("Não é possível remover o último administrador");
      }
    }

    if (data.enabled) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: data.user_id, role: data.role });
      // Ignore duplicate conflicts
      if (error && !error.message.toLowerCase().includes("duplicate")) {
        throw new Error(error.message);
      }
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.user_id)
        .eq("role", data.role);
      if (error) throw new Error(error.message);
    }

    return { success: true };
  });

// ─── Send password reset email ──────────────────────────────────────────────
const emailSchema = z.object({ user_id: z.string().uuid() });

export const sendPasswordReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => emailSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertCallerIsAdmin(context.userId);
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(data.user_id);
    const email = authUser?.user?.email;
    if (!email) throw new Error("Usuário sem e-mail cadastrado");

    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.SITE_URL ?? "https://liga-metropole-digital.lovable.app"}/reset-password`,
    });
    if (error) throw new Error(error.message);
    return { success: true, email };
  });

// ─── Delete user (auth + all app data via cascades) ─────────────────────────
const deleteUserSchema = z.object({ user_id: z.string().uuid() });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => deleteUserSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertCallerIsAdmin(context.userId);
    if (data.user_id === context.userId) {
      throw new Error("Você não pode excluir a própria conta por aqui");
    }

    // Anti-lockout: don't allow deleting the last admin
    const { data: targetRoles } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", data.user_id);
    const isTargetAdmin = (targetRoles ?? []).some((r) => r.role === "admin");
    if (isTargetAdmin) {
      const { count } = await supabaseAdmin
        .from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "admin");
      if ((count ?? 0) <= 1) throw new Error("Não é possível excluir o último administrador");
    }

    // Detach team ownership so cascades don't nuke teams (kept for history)
    await supabaseAdmin
      .from("teams")
      .update({ manager_id: null } as never)
      .eq("manager_id", data.user_id);

    // Remove memberships, roles, supporters, profile
    await supabaseAdmin.from("team_members").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("team_supporters").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("profiles").delete().eq("id", data.user_id);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { success: true };
  });

// ─── Transfer team ownership ────────────────────────────────────────────────
const transferSchema = z.object({
  team_id: z.string().uuid(),
  new_manager_id: z.string().uuid(),
});

export const transferTeamOwnership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => transferSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertCallerIsAdmin(context.userId);

    // Ensure the target user exists
    const { data: target } = await supabaseAdmin.auth.admin.getUserById(data.new_manager_id);
    if (!target?.user) throw new Error("Usuário destino não encontrado");

    const { error: upErr } = await supabaseAdmin
      .from("teams")
      .update({ manager_id: data.new_manager_id } as never)
      .eq("id", data.team_id);
    if (upErr) throw new Error(upErr.message);

    // Grant director role & ensure membership
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: data.new_manager_id, role: "director" }, { onConflict: "user_id,role" });

    await supabaseAdmin
      .from("team_members")
      .upsert(
        {
          team_id: data.team_id,
          user_id: data.new_manager_id,
          role: "director",
          accepted_at: new Date().toISOString(),
        } as never,
        { onConflict: "team_id,user_id" },
      );

    return { success: true };
  });
