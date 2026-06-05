import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const adminDb = supabaseAdmin as any;

export type PagamentoStatus = "pendente" | "pago" | "atrasado";
export type PagamentoMetodo = "pix" | "outro";

export function mesAtual(): string {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-01";
}

export function ultimosMeses(n: number): string[] {
  const result: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 0; i < n; i++) {
    result.push(d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-01");
    d.setMonth(d.getMonth() - 1);
  }
  return result;
}

export function calcStatus(p: { status: PagamentoStatus; mes_referencia: string }): PagamentoStatus {
  if (p.status === "pago") return "pago";
  const deadline = new Date(p.mes_referencia);
  deadline.setDate(deadline.getDate() + 30);
  if (Date.now() > deadline.getTime()) return "atrasado";
  return "pendente";
}

export function diasAtraso(mes_referencia: string): number {
  const deadline = new Date(mes_referencia);
  deadline.setDate(deadline.getDate() + 30);
  const diff = Date.now() - deadline.getTime();
  return diff > 0 ? Math.floor(diff / 86400000) : 0;
}

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso negado: apenas administradores.");
}

async function getDirectorTeamId(userId: string): Promise<string | null> {
  const { data: team } = await supabaseAdmin
    .from("teams").select("id").eq("manager_id", userId).maybeSingle();
  if (team) return team.id;
  const { data: member } = await supabaseAdmin
    .from("team_members").select("team_id")
    .eq("user_id", userId).eq("role", "director")
    .not("accepted_at", "is", null).maybeSingle();
  return member?.team_id ?? null;
}

// Admin: listar pagamentos do mes com dados do time
export const listPagamentosMes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ mes_referencia: z.string().regex(/^[0-9]{4}-[0-9]{2}-01$/) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    const { data: teams, error: teamsErr } = await supabaseAdmin
      .from("teams")
      .select("id, name, short_name, registration_type, primary_color, manager_id")
      .eq("status", "approved").order("name");
    if (teamsErr) throw new Error(teamsErr.message);

    const teamIds = (teams ?? []).map((t) => t.id);
    const { data: pags } = await adminDb
      .from("pagamentos").select("*")
      .eq("mes_referencia", data.mes_referencia).in("time_id", teamIds);

    const pagMap = new Map((pags ?? []).map((p) => [p.time_id, p]));
    const managerIds = [...new Set((teams ?? []).map((t) => t.manager_id).filter(Boolean))];
    const { data: profiles } = managerIds.length
      ? await supabaseAdmin.from("profiles").select("id, full_name, phone").in("id", managerIds)
      : { data: [] as { id: string; full_name: string; phone: string }[] };
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    const rows = (teams ?? []).map((team) => {
      const pag = pagMap.get(team.id);
      const statusCalc = pag
        ? calcStatus({ status: pag.status as PagamentoStatus, mes_referencia: data.mes_referencia })
        : "pendente" as PagamentoStatus;
      const dias = statusCalc === "atrasado" ? diasAtraso(data.mes_referencia) : 0;
      const profile = profileMap.get(team.manager_id);
      return {
        team_id: team.id,
        team_name: team.name,
        team_short_name: team.short_name,
        team_primary_color: team.primary_color,
        registration_type: team.registration_type as "host" | "visitor",
        director_name: profile?.full_name ?? null,
        director_phone: profile?.phone ?? null,
        pagamento_id: pag?.id ?? null,
        status: statusCalc,
        valor: pag?.valor ?? 0,
        data_pagamento: pag?.data_pagamento ?? null,
        metodo: (pag?.metodo ?? null) as PagamentoMetodo | null,
        observacoes: pag?.observacoes ?? null,
        dias_atraso: dias,
        inadimplente: dias > 30,
      };
    });

    return { rows, mes_referencia: data.mes_referencia };
  });

// Admin: marcar como pago
export const marcarComoPago = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      time_id: z.string().uuid(),
      mes_referencia: z.string().regex(/^[0-9]{4}-[0-9]{2}-01$/),
      valor: z.number().min(0).default(0),
      metodo: z.enum(["pix", "outro"]).default("pix"),
      observacoes: z.string().max(500).optional().nullable(),
    }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const payload = {
      time_id: data.time_id,
      mes_referencia: data.mes_referencia,
      valor: data.valor,
      status: "pago" as const,
      data_pagamento: new Date().toISOString(),
      metodo: data.metodo,
      observacoes: data.observacoes ?? null,
      marcado_por: context.userId,
    };
    const { data: existing } = await adminDb
      .from("pagamentos").select("id")
      .eq("time_id", data.time_id).eq("mes_referencia", data.mes_referencia).maybeSingle();
    if (existing) {
      const { error } = await adminDb.from("pagamentos").update(payload).eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await adminDb.from("pagamentos").insert(payload);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// Admin: desfazer pagamento
export const desfazerPagamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      time_id: z.string().uuid(),
      mes_referencia: z.string().regex(/^[0-9]{4}-[0-9]{2}-01$/),
    }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    await supabaseAdmin.from("pagamentos").update({
      status: "pendente", data_pagamento: null, metodo: null, marcado_por: context.userId,
    }).eq("time_id", data.time_id).eq("mes_referencia", data.mes_referencia);
    return { ok: true };
  });

// Admin: totalizadores do mes
export const getTotalizadores = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ mes_referencia: z.string().regex(/^[0-9]{4}-[0-9]{2}-01$/) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: pags } = await supabaseAdmin
      .from("pagamentos").select("status, valor, mes_referencia")
      .eq("mes_referencia", data.mes_referencia);
    const rows = pags ?? [];
    const receitaMes = rows.filter((p) => p.status === "pago").reduce((s, p) => s + Number(p.valor), 0);
    const aReceber = rows.filter((p) => p.status !== "pago").reduce((s, p) => s + Number(p.valor), 0);
    const atrasadoTotal = rows
      .filter((p) => calcStatus({ status: p.status as PagamentoStatus, mes_referencia: p.mes_referencia }) === "atrasado")
      .reduce((s, p) => s + Number(p.valor), 0);
    return { receitaMes, aReceber, atrasadoTotal };
  });

// Admin: exportar inadimplentes CSV
export const exportInadimplentesCSV = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ mes_referencia: z.string().regex(/^[0-9]{4}-[0-9]{2}-01$/) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: teams } = await supabaseAdmin
      .from("teams").select("id, name, short_name, registration_type, manager_id")
      .eq("status", "approved");
    const teamIds = (teams ?? []).map((t) => t.id);
    const { data: pags } = await supabaseAdmin
      .from("pagamentos").select("time_id, status, valor, mes_referencia")
      .eq("mes_referencia", data.mes_referencia).in("time_id", teamIds);
    const pagMap = new Map((pags ?? []).map((p) => [p.time_id, p]));
    const managerIds = [...new Set((teams ?? []).map((t) => t.manager_id).filter(Boolean))];
    const { data: profiles } = managerIds.length
      ? await supabaseAdmin.from("profiles").select("id, full_name, phone").in("id", managerIds)
      : { data: [] as { id: string; full_name: string; phone: string }[] };
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    const inadimplentes = (teams ?? []).filter((team) => {
      const pag = pagMap.get(team.id);
      if (!pag) return true;
      return calcStatus({ status: pag.status as PagamentoStatus, mes_referencia: data.mes_referencia }) !== "pago";
    });

    const header = "Time,Sigla,Tipo,Diretor,Telefone,Status,Dias Atraso,Valor";
    const lines = inadimplentes.map((team) => {
      const pag = pagMap.get(team.id);
      const s = pag ? calcStatus({ status: pag.status as PagamentoStatus, mes_referencia: data.mes_referencia }) : "pendente";
      const dias = s === "atrasado" ? diasAtraso(data.mes_referencia) : 0;
      const profile = profileMap.get(team.manager_id);
      return ['"' + team.name + '"', team.short_name,
        team.registration_type === "host" ? "Mandante" : "Visitante",
        '"' + (profile?.full_name ?? "") + '"', profile?.phone ?? "",
        s, dias, pag?.valor ?? 0].join(",");
    });
    return { csv: [header, ...lines].join("\n"), total: inadimplentes.length };
  });

// Diretor: ver pagamentos do proprio time (6 meses)
export const getMyTeamPagamentos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const teamId = await getDirectorTeamId(context.userId);
    if (!teamId) return { meses: [], team_id: null };
    const meses = ultimosMeses(6);
    const { data: pags } = await supabaseAdmin
      .from("pagamentos").select("*")
      .eq("time_id", teamId).in("mes_referencia", meses);
    const pagMap = new Map((pags ?? []).map((p) => [p.mes_referencia, p]));
    const result = meses.map((mes) => {
      const pag = pagMap.get(mes);
      return {
        mes_referencia: mes,
        status: pag ? calcStatus({ status: pag.status as PagamentoStatus, mes_referencia: mes }) : "pendente" as PagamentoStatus,
        valor: pag?.valor ?? 0,
        data_pagamento: pag?.data_pagamento ?? null,
        metodo: (pag?.metodo ?? null) as PagamentoMetodo | null,
        dias_atraso: diasAtraso(mes),
      };
    });
    return { meses: result, team_id: teamId };
  });
