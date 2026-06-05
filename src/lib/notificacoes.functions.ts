import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificacaoTipo =
  | "team_approved"
  | "jogo_agendado"
  | "sumula_disponivel"
  | "sumula_prazo_alerta"
  | "destaque_publicado";

export type NotificacaoCanal = "email" | "whatsapp";
export type NotificacaoStatus = "pendente" | "enviado" | "falhou";

export interface NotificacaoLog {
  id: string;
  tipo: NotificacaoTipo;
  canal: NotificacaoCanal;
  destinatario_id: string | null;
  destinatario_email: string | null;
  destinatario_nome: string | null;
  destinatario_phone: string | null;
  assunto: string | null;
  corpo_preview: string | null;
  status: NotificacaoStatus;
  erro_mensagem: string | null;
  payload: Record<string, unknown>;
  whatsapp_template: string | null;
  enviado_em: string | null;
  created_at: string;
}

// ─── Label helpers ─────────────────────────────────────────────────────────────

export const TIPO_LABELS: Record<NotificacaoTipo, string> = {
  team_approved: "Time Aprovado",
  jogo_agendado: "Jogo Agendado",
  sumula_disponivel: "Súmula Disponível",
  sumula_prazo_alerta: "Alerta de Prazo",
  destaque_publicado: "Destaque Publicado",
};

export const STATUS_LABELS: Record<NotificacaoStatus, string> = {
  pendente: "Pendente",
  enviado: "Enviado",
  falhou: "Falhou",
};

export const CANAL_LABELS: Record<NotificacaoCanal, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
};

const notificacoesFilterSchema = z.object({
  limit: z.number().min(1).max(500).default(100),
  tipo: z
    .enum([
      "team_approved",
      "jogo_agendado",
      "sumula_disponivel",
      "sumula_prazo_alerta",
      "destaque_publicado",
    ])
    .optional(),
  status: z.enum(["pendente", "enviado", "falhou"]).optional(),
  canal: z.enum(["email", "whatsapp"]).optional(),
});

const triggerNotificacaoSchema = z.object({
  functionName: z.enum([
    "notify-team-approved",
    "notify-jogo-agendado",
    "notify-sumula-disponivel",
    "notify-sumula-prazo-alerta",
    "notify-destaque-publicado",
  ]),
  payload: z.record(z.string(), z.unknown()),
});

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito a administradores");
}

const adminDb = supabaseAdmin as any;

// ─── Server Functions ──────────────────────────────────────────────────────────

/**
 * List last N notification log entries (admin only)
 */
export const listNotificacoes = createServerFn({ method: "GET" })
  .inputValidator((input) => notificacoesFilterSchema.parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    let query = adminDb
      .from("notificacoes_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.tipo) {
      query = query.eq("tipo", data.tipo);
    }
    if (data.status) {
      query = query.eq("status", data.status);
    }
    if (data.canal) {
      query = query.eq("canal", data.canal);
    }

    const { data: logs, error } = await query;

    if (error) {
      throw new Error(`Erro ao buscar notificações: ${error.message}`);
    }

    return { logs: (logs ?? []) as NotificacaoLog[] };
  });

/**
 * Get notification stats for dashboard
 */
export const getNotificacoesStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);

    const { data: stats } = await adminDb
      .from("notificacoes_log")
      .select("status, canal, tipo");

    const total = stats?.length ?? 0;
    const enviados = stats?.filter((s) => s.status === "enviado").length ?? 0;
    const falhos = stats?.filter((s) => s.status === "falhou").length ?? 0;
    const pendentes = stats?.filter((s) => s.status === "pendente").length ?? 0;

    const byTipo = Object.entries(TIPO_LABELS).map(([tipo, label]) => ({
      tipo: tipo as NotificacaoTipo,
      label,
      count: stats?.filter((s) => s.tipo === tipo).length ?? 0,
    }));

    return { total, enviados, falhos, pendentes, byTipo };
  });

/**
 * Trigger an Edge Function manually (admin only)
 * Useful for retrying failed notifications
 */
export const triggerNotificacao = createServerFn({ method: "POST" })
  .inputValidator((input) => triggerNotificacaoSchema.parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    const supabaseUrl = process.env["SUPABASE_URL"];
    const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

    if (!supabaseUrl || !serviceKey) {
      throw new Error("Supabase credentials not configured");
    }

    const response = await fetch(
      `${supabaseUrl}/functions/v1/${data.functionName}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify(data.payload),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error ?? `Edge Function returned ${response.status}`);
    }

    return result as { success: boolean; log_ids?: string[] };
  });
