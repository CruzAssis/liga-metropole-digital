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
  lado: z.enum(["A", "B"]).optional(),
  subprefeitura: z.string().max(120).optional().nullable(),
  bairro: z.string().max(120).optional().nullable(),
  maps_link: z.string().max(500).optional().nullable(),
  logo_url: z.string().max(500).optional().nullable(),
  home_venue: z.string().max(255).optional().nullable(),
  home_time: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/)
    .optional()
    .nullable(),
  primary_color: hex,
  secondary_color: hex,
  tertiary_color: hex,
  // Optional: link to a competition (league) at inscription time
  competition_id: z.string().uuid().optional().nullable(),
});

function makeShortName(name: string) {
  const clean = name
    .trim()
    .replace(/[^a-zA-ZA-z\s]/g, "")
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
      throw new Error("Mandante precisa informar o endereco do campo");
    }

    // Read master switch + host slots limit
    const { data: settings } = await supabaseAdmin
      .from("system_settings")
      .select("master_registration_open, host_slots_limit")
      .eq("id", true)
      .maybeSingle();

    const masterOpen = (settings as { master_registration_open?: boolean } | null)?.master_registration_open ?? false;
    const globalHostLimit =
      (settings as { host_slots_limit?: number } | null)?.host_slots_limit ?? 20;

    // Master desligado: todo mundo espera.
    let initialStatus: "pending" | "waitlist" = masterOpen ? "pending" : "waitlist";

    // If a competition_id was provided, verify it is open for registration
    type CompSlots = {
      registration_status: string;
      max_teams: number;
      host_slots: number;
      visitor_slots: number;
    };
    let comp: CompSlots | null = null;
    if (data.competition_id) {
      const { data: found, error: compErr } = await supabaseAdmin
        .from("competitions")
        .select("id, registration_status, max_teams, host_slots, visitor_slots")
        .eq("id", data.competition_id)
        .single();

      if (compErr || !found) {
        throw new Error("Liga nao encontrada");
      }
      comp = found as CompSlots;
      if (comp!.registration_status !== "open") {
        throw new Error("Esta liga nao esta aceitando novas inscricoes");
      }

      const { count } = await supabaseAdmin
        .from("teams")
        .select("id", { count: "exact", head: true })
        .eq("competition_id", data.competition_id)
        .eq("status", "approved");

      if ((count ?? 0) >= comp!.max_teams) {
        throw new Error("Liga lotada. O numero maximo de equipes foi atingido");
      }
    }

    // Vagas por categoria.
    //
    // Antes so o Mandante tinha teto, e vinha de system_settings (global,
    // default 20). O Visitante nao tinha teto NENHUM: dava para inscrever 40
    // visitantes numa liga vendida como "10 e 10". E o teto de mandante
    // ignorava competitions.host_slots, que e onde o numero da competicao
    // esta configurado.
    //
    // Agora: quando ha competicao, valem os slots dela e a contagem e dentro
    // dela; sem competicao, cai no limite global de mandante como antes.
    // Estourou, a inscricao entra em waitlist — nao e recusada, porque time
    // na fila e exatamente o que garante repor quem desistir antes da trava.
    if (masterOpen) {
      const isHost = data.registration_type === "host";
      let approvedQ = supabaseAdmin
        .from("teams")
        .select("id", { count: "exact", head: true })
        .eq("registration_type", data.registration_type)
        .eq("status", "approved");

      let limit: number;
      if (comp && data.competition_id) {
        approvedQ = approvedQ.eq("competition_id", data.competition_id);
        limit = isHost ? comp.host_slots : comp.visitor_slots;
      } else {
        limit = isHost ? globalHostLimit : Number.POSITIVE_INFINITY;
      }

      if (Number.isFinite(limit)) {
        const { count: approvedSameType } = await approvedQ;
        if ((approvedSameType ?? 0) >= limit) {
          initialStatus = "waitlist";
        }
      }
    }

    const slug = data.name
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 60);

    const { data: team, error: teamErr } = await supabaseAdmin
      .from("teams")
      .insert({
        name: data.name.trim(),
        short_name,
        slug: slug || null,
        manager_id: userId,
        registration_type: data.registration_type,
        status: initialStatus,
        lado: data.lado ?? "A",
        serie: "A",
        subprefeitura: data.subprefeitura?.trim() || null,
        bairro: data.bairro?.trim() || null,
        maps_link: data.maps_link?.trim() || null,
        logo_url: data.logo_url?.trim() || null,
        home_venue: data.home_venue?.trim() || null,
        home_time: data.registration_type === "host" ? data.home_time || null : null,
        primary_color: data.primary_color || null,
        secondary_color: data.secondary_color || null,
        tertiary_color: data.tertiary_color || null,
        competition_id: data.competition_id || null,
      } as never)
      .select("id, invite_code")
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

    return { team_id: team.id, invite_code: (team as { invite_code?: string }).invite_code ?? null };
  });
