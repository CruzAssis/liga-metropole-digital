// Server-only helper for writing to admin_audit_log.
// Never import at module scope of a client-reachable file — always dynamic-import inside handlers.

type Claims = { sub?: string; email?: string } & Record<string, unknown>;

export async function logAudit(params: {
  claims: Claims | null | undefined;
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("admin_audit_log").insert({
      actor_id: params.claims?.sub ?? null,
      actor_email: (params.claims?.email as string | undefined) ?? null,
      action: params.action,
      entity_type: params.entity_type ?? null,
      entity_id: params.entity_id ? String(params.entity_id) : null,
      metadata: params.metadata ?? {},
    } as never);
  } catch (e) {
    // Audit failure must never break the primary admin action.
    console.error("[audit] failed to log", e);
  }
}
