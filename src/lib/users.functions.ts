import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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
