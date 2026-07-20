import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Response("Forbidden", { status: 403 });
}

export type AuditRow = {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, string | number | boolean | null>;
  created_at: string;
};

const listSchema = z.object({
  action: z.string().trim().max(80).optional().nullable(),
  entity_type: z.string().trim().max(80).optional().nullable(),
  search: z.string().trim().max(120).optional().nullable(),
  from: z.string().trim().max(40).optional().nullable(),
  to: z.string().trim().max(40).optional().nullable(),
  limit: z.number().int().min(1).max(500).optional(),
});

export const adminListAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => listSchema.parse(i ?? {}))
  .handler(async ({ data, context }): Promise<AuditRow[]> => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("admin_audit_log")
      .select("id, actor_id, actor_email, action, entity_type, entity_id, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 200);
    if (data.action) q = q.eq("action", data.action);
    if (data.entity_type) q = q.eq("entity_type", data.entity_type);
    if (data.search) q = q.ilike("actor_email", `%${data.search}%`);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as unknown as AuditRow[];
  });
