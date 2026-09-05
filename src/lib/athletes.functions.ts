import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getRequest } from "@tanstack/react-start/server";
import { onlyDigits, isValidCpf, cpfLast4, maskFullName } from "./cpf";

const BCRYPT_ROUNDS = 10;

// =============================================================
// Pre-register athletes (manager pre-registers CPFs for their team)
// =============================================================
const preRegisterSchema = z.object({
  cpfs: z.array(z.string().min(11).max(20)).min(1).max(200),
});

export const preRegisterAthletes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => preRegisterSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // find manager's team
    const { data: team, error: teamErr } = await supabaseAdmin
      .from("teams")
      .select("id")
      .eq("manager_id", userId)
      .maybeSingle();
    if (teamErr) throw new Error(teamErr.message);
    if (!team) {
      throw new Response(JSON.stringify({ error: "Você precisa ter um time inscrito" }), {
        status: 400,
      });
    }

    let created = 0;
    let invalid = 0;
    let duplicates = 0;
    const errors: string[] = [];

    for (const raw of data.cpfs) {
      const cpf = onlyDigits(raw);
      if (!isValidCpf(cpf)) {
        invalid++;
        continue;
      }
      const last4 = cpfLast4(cpf);

      // bcrypt.compare against existing rows with same last4
      const { data: candidates } = await supabaseAdmin
        .from("athletes")
        .select("id, cpf_hash")
        .eq("cpf_last4", last4);

      let alreadyExists = false;
      for (const c of candidates ?? []) {
        if (c.cpf_hash && await bcrypt.compare(cpf, c.cpf_hash)) {
          alreadyExists = true;
          break;
        }
      }
      if (alreadyExists) {
        duplicates++;
        continue;
      }

      const hash = await bcrypt.hash(cpf, BCRYPT_ROUNDS);
      const { error: insErr } = await supabaseAdmin.from("athletes").insert({
        team_id: team.id,
        cpf_hash: hash,
        cpf_last4: last4,
        verified: false,
      });
      if (insErr) {
        errors.push(insErr.message);
        continue;
      }
      created++;
    }

    return { created, invalid, duplicates, errors };
  });

// =============================================================
// Publico: localizar pre-cadastro por CPF (usado em /verificar)
//
// Esta e a unica rota que aceita CPF sem login. Duas travas obrigatorias:
//
//  1. RATE LIMIT por hash de IP. Sem ele, CPF valido e enumeravel e a base
//     inteira sai pela porta da frente.
//  2. DIVULGACAO MINIMA. Antes daqui saiam nome completo, WhatsApp,
//     Instagram, foto e time — um dossie por CPF adivinhado. Agora sai o
//     nome mascarado, que e o suficiente para o atleta reconhecer o proprio
//     pre-cadastro e nao serve para montar base de terceiros.
//
// Falha fechada de proposito: sem IP_HASH_SALT ou sem a migration de rate
// limit aplicada, a rota responde 503 em vez de responder sem protecao.
// =============================================================
const findSchema = z.object({ cpf: z.string().min(11).max(20) });

function clientIp(req: Request | undefined): string {
  const h = req?.headers;
  if (!h) return "";
  const forwarded = h.get("x-forwarded-for");
  const firstHop = forwarded ? forwarded.split(",")[0].trim() : "";
  return h.get("cf-connecting-ip") ?? h.get("x-real-ip") ?? firstHop;
}

async function hashIp(ip: string, salt: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const findAthleteByCpf = createServerFn({ method: "POST" })
  .inputValidator((input) => findSchema.parse(input))
  .handler(async ({ data }) => {
    const salt = process.env.IP_HASH_SALT ?? "";
    if (!salt) {
      console.error("[verificar] IP_HASH_SALT ausente — consulta por CPF bloqueada");
      throw new Response(
        JSON.stringify({ error: "Consulta indisponivel no momento. Tente mais tarde." }),
        { status: 503 },
      );
    }

    const ip = clientIp(getRequest()) || "sem-ip";
    const ipHash = await hashIp(ip, salt);

    // A funcao e nova e ainda nao esta em integrations/supabase/types.ts
    // (o arquivo e gerado). Mesmo padrao usado em sumula-digital.functions.ts.
    const { data: limit, error: limitErr } = await (supabaseAdmin as any).rpc(
      "check_cpf_lookup_rate_limit",
      { _ip_hash: ipHash },
    );
    if (limitErr) {
      console.error("[verificar] rate limit indisponivel:", limitErr.message);
      throw new Response(
        JSON.stringify({ error: "Consulta indisponivel no momento. Tente mais tarde." }),
        { status: 503 },
      );
    }
    const verdict = limit as { allowed: boolean; retry_after_seconds?: number } | null;
    if (!verdict?.allowed) {
      throw new Response(
        JSON.stringify({
          error: "Muitas consultas seguidas. Aguarde alguns minutos e tente de novo.",
        }),
        {
          status: 429,
          headers: { "retry-after": String(verdict?.retry_after_seconds ?? 600) },
        },
      );
    }

    const cpf = onlyDigits(data.cpf);
    if (!isValidCpf(cpf)) {
      throw new Response(JSON.stringify({ error: "CPF invalido" }), { status: 400 });
    }

    const last4 = cpfLast4(cpf);
    const { data: candidates, error } = await supabaseAdmin
      .from("athletes")
      .select("id, cpf_hash, full_name, nickname, team_id, verified")
      .eq("cpf_last4", last4);
    if (error) throw new Error(error.message);

    for (const c of candidates ?? []) {
      if (c.cpf_hash && (await bcrypt.compare(cpf, c.cpf_hash))) {
        // Nome do time e informacao publica (aparece em /times) e e o que
        // permite ao atleta reconhecer o pre-cadastro. Nome vai mascarado.
        let teamName: string | null = null;
        if (c.team_id) {
          const { data: team } = await supabaseAdmin
            .from("teams")
            .select("name")
            .eq("id", c.team_id)
            .maybeSingle();
          teamName = team?.name ?? null;
        }
        return {
          found: true as const,
          athlete: {
            id: c.id,
            masked_name: maskFullName(c.full_name ?? c.nickname),
            team_name: teamName,
            verified: c.verified,
          },
        };
      }
    }
    return { found: false as const };
  });

// =============================================================
// Verify athlete (authenticated user claims an athlete by CPF)
// =============================================================
const verifySchema = z.object({
  cpf: z.string().min(11).max(20),
  full_name: z.string().trim().min(2).max(120),
  nickname: z.string().trim().min(1).max(40),
  position: z.string().trim().max(30).optional(),
  photo_url: z.string().url().optional(),
  whatsapp: z.string().trim().max(20).optional(),
  instagram_handle: z.string().trim().max(40).optional(),
});

export const verifyAthlete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => verifySchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const cpf = onlyDigits(data.cpf);
    if (!isValidCpf(cpf)) {
      throw new Response(JSON.stringify({ error: "CPF inválido" }), { status: 400 });
    }

    const last4 = cpfLast4(cpf);
    const { data: candidates, error } = await supabaseAdmin
      .from("athletes")
      .select("id, cpf_hash, verified, user_id")
      .eq("cpf_last4", last4);
    if (error) throw new Error(error.message);

    let match: { id: string; verified: boolean; user_id: string | null } | null = null;
    for (const c of candidates ?? []) {
      if (c.cpf_hash && await bcrypt.compare(cpf, c.cpf_hash)) {
        match = { id: c.id, verified: c.verified, user_id: c.user_id };
        break;
      }
    }
    if (!match) {
      throw new Response(JSON.stringify({ error: "CPF não encontrado" }), { status: 404 });
    }
    if (match.user_id && match.user_id !== userId) {
      throw new Response(
        JSON.stringify({ error: "Este atleta já foi verificado por outro usuário" }),
        { status: 409 },
      );
    }

    const { error: updErr } = await supabaseAdmin
      .from("athletes")
      .update({
        full_name: data.full_name,
        nickname: data.nickname,
        position: data.position ?? null,
        photo_url: data.photo_url ?? null,
        whatsapp: data.whatsapp ?? null,
        instagram_handle: data.instagram_handle ?? null,
        verified: true,
        verified_at: new Date().toISOString(),
        user_id: userId,
      })
      .eq("id", match.id);
    if (updErr) throw new Error(updErr.message);

    return { success: true, athleteId: match.id };
  });

// =============================================================
// List team athletes (for manager dashboard)
// =============================================================
export const listMyTeamAthletes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data: team } = await supabaseAdmin
      .from("teams")
      .select("id, name")
      .eq("manager_id", userId)
      .maybeSingle();
    if (!team) return { team: null, athletes: [] };

    const { data: athletes, error } = await supabaseAdmin
      .from("athletes")
      .select("id, full_name, nickname, position, photo_url, verified, cpf_last4, whatsapp, created_at")
      .eq("team_id", team.id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    return { team, athletes: athletes ?? [] };
  });

// =============================================================
// Director-managed athletes (no CPF): create / update / delete
// =============================================================
async function requireMyTeamId(userId: string): Promise<string> {
  const { data: team, error } = await supabaseAdmin
    .from("teams")
    .select("id")
    .eq("manager_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!team) {
    throw new Response(JSON.stringify({ error: "Você precisa ter um time inscrito" }), { status: 400 });
  }
  return team.id;
}

const createAthleteSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  nickname: z.string().trim().min(1).max(40),
  position: z.string().trim().min(1).max(30),
  whatsapp: z.string().trim().max(20).optional().nullable(),
});

export const createDirectorAthlete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createAthleteSchema.parse(input))
  .handler(async ({ data, context }) => {
    const teamId = await requireMyTeamId(context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("athletes")
      .insert({
        team_id: teamId,
        full_name: data.full_name,
        nickname: data.nickname,
        position: data.position,
        whatsapp: data.whatsapp || null,
        verified: false,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

const updateAthleteSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string().trim().min(2).max(120),
  nickname: z.string().trim().min(1).max(40),
  position: z.string().trim().min(1).max(30),
  whatsapp: z.string().trim().max(20).optional().nullable(),
});

export const updateDirectorAthlete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => updateAthleteSchema.parse(input))
  .handler(async ({ data, context }) => {
    const teamId = await requireMyTeamId(context.userId);
    const { error } = await supabaseAdmin
      .from("athletes")
      .update({
        full_name: data.full_name,
        nickname: data.nickname,
        position: data.position,
        whatsapp: data.whatsapp || null,
      })
      .eq("id", data.id)
      .eq("team_id", teamId);
    if (error) throw new Error(error.message);
    return { success: true };
  });

const deleteAthleteSchema = z.object({ id: z.string().uuid() });

export const deleteDirectorAthlete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => deleteAthleteSchema.parse(input))
  .handler(async ({ data, context }) => {
    const teamId = await requireMyTeamId(context.userId);
    const { error } = await supabaseAdmin
      .from("athletes")
      .delete()
      .eq("id", data.id)
      .eq("team_id", teamId);
    if (error) throw new Error(error.message);
    return { success: true };
  });

