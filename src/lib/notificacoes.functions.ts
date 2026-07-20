import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildWaMeUrl } from "@/lib/notify.server";

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificacaoTipo =
  | "team_approved"
  | "jogo_agendado"
  | "sumula_disponivel"
  | "sumula_prazo_alerta"
  | "destaque_publicado"
  | "broadcast";

export type NotificacaoCanal = "email" | "whatsapp";
export type NotificacaoStatus = "pendente" | "enviado" | "falhou";
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

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
  whatsapp_url: string | null;
  status: NotificacaoStatus;
  erro_mensagem: string | null;
  payload: JsonValue;
  whatsapp_template: string | null;
  enviado_em: string | null;
  send_count: number;
  created_at: string;
}

// ─── Label helpers ─────────────────────────────────────────────────────────────

export const TIPO_LABELS: Record<NotificacaoTipo, string> = {
  team_approved: "Time Aprovado",
  jogo_agendado: "Jogo Agendado",
  sumula_disponivel: "Súmula Disponível",
  sumula_prazo_alerta: "Alerta de Prazo",
  destaque_publicado: "Destaque Publicado",
  broadcast: "Mensagem Manual",
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

const TIPO_ENUM = [
  "team_approved",
  "jogo_agendado",
  "sumula_disponivel",
  "sumula_prazo_alerta",
  "destaque_publicado",
  "broadcast",
] as const;

const notificacoesFilterSchema = z.object({
  limit: z.number().min(1).max(500).default(100),
  tipo: z.enum(TIPO_ENUM).optional(),
  status: z.enum(["pendente", "enviado", "falhou"]).optional(),
  canal: z.enum(["email", "whatsapp"]).optional(),
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

export const listNotificacoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => notificacoesFilterSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    let query = adminDb
      .from("notificacoes_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.tipo) query = query.eq("tipo", data.tipo);
    if (data.status) query = query.eq("status", data.status);
    if (data.canal) query = query.eq("canal", data.canal);
    const { data: logs, error } = await query;
    if (error) throw new Error(`Erro ao buscar notificações: ${error.message}`);
    return { logs: (logs ?? []) as NotificacaoLog[] };
  });

export const getNotificacoesStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data: stats } = await adminDb.from("notificacoes_log").select("status, canal, tipo");
    const rows = (stats ?? []) as Array<{
      status: NotificacaoStatus;
      canal: NotificacaoCanal;
      tipo: NotificacaoTipo;
    }>;
    return {
      total: rows.length,
      enviados: rows.filter((s) => s.status === "enviado").length,
      falhos: rows.filter((s) => s.status === "falhou").length,
      pendentes: rows.filter((s) => s.status === "pendente").length,
      byTipo: Object.entries(TIPO_LABELS).map(([tipo, label]) => ({
        tipo: tipo as NotificacaoTipo,
        label,
        count: rows.filter((s) => s.tipo === tipo).length,
      })),
    };
  });

/** Marca uma notificação como enviada (após admin clicar em "Abrir WhatsApp"). */
export const markNotificacaoSent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: row } = await adminDb
      .from("notificacoes_log")
      .select("send_count")
      .eq("id", data.id)
      .maybeSingle();
    const nextCount = (row?.send_count ?? 0) + 1;
    const { error } = await adminDb
      .from("notificacoes_log")
      .update({
        status: "enviado",
        enviado_em: new Date().toISOString(),
        send_count: nextCount,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true, send_count: nextCount };
  });

/** Envia um broadcast (mensagem manual) para uma lista de contatos. */
const broadcastSchema = z.object({
  message: z.string().trim().min(3).max(1000),
  audience: z.enum(["directors_all", "custom"]),
  team_id: z.string().uuid().optional().nullable(),
  custom_contacts: z
    .array(
      z.object({
        nome: z.string().max(120).optional().nullable(),
        phone: z.string().min(8).max(20),
      }),
    )
    .max(200)
    .optional(),
});

export const broadcastWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => broadcastSchema.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    type Contact = { id: string | null; nome: string | null; phone: string };
    const contacts: Contact[] = [];

    if (data.audience === "directors_all") {
      // busca todos os managers de times aprovados
      const { data: teams } = await adminDb
        .from("teams")
        .select("id, name, manager_id, status");
      const managerIds = Array.from(
        new Set(
          ((teams ?? []) as Array<{ manager_id: string | null }>)
            .map((t) => t.manager_id)
            .filter((v): v is string => Boolean(v)),
        ),
      );
      if (managerIds.length) {
        const { data: profiles } = await adminDb
          .from("profiles")
          .select("id, full_name, whatsapp, phone")
          .in("id", managerIds);
        for (const p of (profiles ?? []) as Array<{
          id: string;
          full_name: string | null;
          whatsapp: string | null;
          phone: string | null;
        }>) {
          const phone = p.whatsapp || p.phone;
          if (phone) contacts.push({ id: p.id, nome: p.full_name, phone });
        }
      }
    } else {
      for (const c of data.custom_contacts ?? []) {
        contacts.push({ id: null, nome: c.nome ?? null, phone: c.phone });
      }
    }

    if (contacts.length === 0) throw new Error("Nenhum contato disponível");

    const rows = contacts.map((c) => {
      const digits = c.phone.replace(/\D+/g, "");
      const normalized = digits.length <= 11 ? `55${digits}` : digits;
      const validPhone = digits.length >= 10;
      return {
        tipo: "broadcast" as const,
        canal: "whatsapp" as const,
        destinatario_id: c.id,
        destinatario_nome: c.nome,
        destinatario_phone: validPhone ? normalized : null,
        corpo_preview: data.message.slice(0, 500),
        whatsapp_url: validPhone ? buildWaMeUrl(normalized, data.message) : null,
        status: validPhone ? "pendente" : "falhou",
        erro_mensagem: validPhone ? null : "Telefone inválido",
        payload: { audience: data.audience },
        created_by: context.userId,
      };
    });

    const { error } = await adminDb.from("notificacoes_log").insert(rows);
    if (error) throw new Error(error.message);
    return { ok: true, count: rows.length };
  });

// ─── Templates ────────────────────────────────────────────────────────────────

export interface NotificationTemplate {
  tipo: NotificacaoTipo;
  assunto: string | null;
  mensagem: string;
  variables: string[];
  updated_at: string;
}

/** Variáveis disponíveis por tipo (documentação para o admin). */
export const TEMPLATE_VARIABLES: Record<NotificacaoTipo, string[]> = {
  team_approved: ["diretor", "time", "status", "status_label"],
  jogo_agendado: ["diretor", "time", "adversario", "data", "local", "tipo_evento"],
  sumula_disponivel: ["diretor", "time", "adversario", "placar_casa", "placar_visitante"],
  sumula_prazo_alerta: ["diretor", "time", "adversario", "horas_restantes"],
  destaque_publicado: ["diretor", "time", "atleta", "nota"],
  broadcast: ["diretor", "mensagem"],
};

export const listTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await adminDb
      .from("notification_templates")
      .select("*")
      .order("tipo");
    if (error) throw new Error(error.message);
    return { templates: (data ?? []) as NotificationTemplate[] };
  });

const upsertTemplateSchema = z.object({
  tipo: z.enum(TIPO_ENUM),
  assunto: z.string().max(300).nullable().optional(),
  mensagem: z.string().min(1).max(2000),
});

export const upsertTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => upsertTemplateSchema.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await adminDb
      .from("notification_templates")
      .update({
        assunto: data.assunto ?? null,
        mensagem: data.mensagem,
        updated_by: context.userId,
      })
      .eq("tipo", data.tipo);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

