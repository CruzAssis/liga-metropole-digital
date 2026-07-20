// Server-only helper para enfileirar notificações WhatsApp (wa.me) e Email.
// Insere um registro "pendente" em notificacoes_log com link wa.me pronto.
// O envio real é manual: admin clica em "Abrir WhatsApp" no painel.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type NotificacaoTipo =
  | "team_approved"
  | "jogo_agendado"
  | "sumula_disponivel"
  | "sumula_prazo_alerta"
  | "destaque_publicado"
  | "broadcast";

interface EnqueueWhatsAppParams {
  tipo: NotificacaoTipo;
  destinatario_id?: string | null;
  destinatario_nome?: string | null;
  destinatario_phone?: string | null;
  assunto?: string | null;
  mensagem: string;
  payload?: Record<string, unknown>;
  created_by?: string | null;
}

/** Normaliza telefone para formato E.164 sem "+" (usado pelo wa.me). */
function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D+/g, "");
  if (digits.length < 10) return null;
  if (digits.length <= 11) return `55${digits}`;
  return digits;
}

/** Gera link wa.me com mensagem pré-preenchida. */
export function buildWaMeUrl(phone: string, message: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export async function enqueueWhatsapp(params: EnqueueWhatsAppParams): Promise<void> {
  const phoneDigits = normalizePhone(params.destinatario_phone);
  const url = phoneDigits ? buildWaMeUrl(phoneDigits, params.mensagem) : null;

  await supabaseAdmin.from("notificacoes_log").insert({
    tipo: params.tipo,
    canal: "whatsapp",
    destinatario_id: params.destinatario_id ?? null,
    destinatario_nome: params.destinatario_nome ?? null,
    destinatario_phone: phoneDigits,
    assunto: params.assunto ?? null,
    corpo_preview: params.mensagem.slice(0, 500),
    whatsapp_url: url,
    status: url ? "pendente" : "falhou",
    erro_mensagem: url ? null : "Telefone não cadastrado ou inválido",
    payload: params.payload ?? {},
    created_by: params.created_by ?? null,
  } as never);
}

export async function fetchTeamManagerContact(teamId: string): Promise<{
  id: string;
  name: string | null;
  phone: string | null;
  team_name: string | null;
} | null> {
  const { data: team } = await supabaseAdmin
    .from("teams")
    .select("manager_id, name")
    .eq("id", teamId)
    .maybeSingle();
  if (!team?.manager_id) return null;
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, whatsapp, phone")
    .eq("id", team.manager_id)
    .maybeSingle();
  if (!profile) return null;
  return {
    id: profile.id,
    name: profile.full_name,
    phone: profile.whatsapp || profile.phone,
    team_name: team.name,
  };
}

// ─── Template rendering ───────────────────────────────────────────────────────

const FALLBACK_TEMPLATES: Record<NotificacaoTipo, { assunto: string; mensagem: string }> = {
  team_approved: {
    assunto: "Status do time: {status}",
    mensagem: "⚽ Olá {diretor}! O time *{time}* foi *{status_label}* na Liga Metrópole.",
  },
  jogo_agendado: {
    assunto: "Jogo {tipo_evento}",
    mensagem: "🏆 Jogo {tipo_evento}\n\n{time} x {adversario}\n📅 {data}\n📍 {local}",
  },
  sumula_disponivel: {
    assunto: "Súmula aguardando validação",
    mensagem: "📋 Súmula pendente — {time} x {adversario}\nPlacar: {placar_casa} x {placar_visitante}",
  },
  sumula_prazo_alerta: {
    assunto: "Prazo da súmula",
    mensagem: "⏰ {diretor}, a súmula de {time} x {adversario} vence em {horas_restantes}h.",
  },
  destaque_publicado: {
    assunto: "Destaque publicado",
    mensagem: "⭐ {atleta} foi destaque de {time} com nota {nota}/10.",
  },
  broadcast: {
    assunto: "Mensagem da Liga",
    mensagem: "{mensagem}",
  },
};

function interpolate(template: string, vars: Record<string, string | number | null | undefined>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const v = vars[key];
    return v === null || v === undefined ? "" : String(v);
  });
}

/** Carrega template do BD (com fallback) e renderiza com as variáveis. */
export async function renderTemplate(
  tipo: NotificacaoTipo,
  vars: Record<string, string | number | null | undefined>,
): Promise<{ assunto: string; mensagem: string }> {
  const { data } = await supabaseAdmin
    .from("notification_templates" as never)
    .select("assunto, mensagem")
    .eq("tipo", tipo)
    .maybeSingle();
  const tpl = (data as { assunto: string | null; mensagem: string } | null) ?? FALLBACK_TEMPLATES[tipo];
  return {
    assunto: interpolate(tpl.assunto ?? "", vars),
    mensagem: interpolate(tpl.mensagem ?? "", vars),
  };
}
