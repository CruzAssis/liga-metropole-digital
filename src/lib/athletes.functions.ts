import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { onlyDigits, isValidCpf, cpfLast4 } from "./cpf";

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
        if (await bcrypt.compare(cpf, c.cpf_hash)) {
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
// Public: find athlete by CPF (used in /verificar)
// =============================================================
const findSchema = z.object({ cpf: z.string().min(11).max(20) });

export const findAthleteByCpf = createServerFn({ method: "POST" })
  .inputValidator((input) => findSchema.parse(input))
  .handler(async ({ data }) => {
    const cpf = onlyDigits(data.cpf);
    if (!isValidCpf(cpf)) {
      throw new Response(JSON.stringify({ error: "CPF inválido" }), { status: 400 });
    }

    const last4 = cpfLast4(cpf);
    const { data: candidates, error } = await supabaseAdmin
      .from("athletes")
      .select("id, cpf_hash, full_name, nickname, position, photo_url, team_id, verified, whatsapp, instagram_handle")
      .eq("cpf_last4", last4);
    if (error) throw new Error(error.message);

    for (const c of candidates ?? []) {
      if (await bcrypt.compare(cpf, c.cpf_hash)) {
        // strip cpf_hash before returning
        const { cpf_hash: _omit, ...safe } = c;
        return { found: true as const, athlete: safe };
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
      if (await bcrypt.compare(cpf, c.cpf_hash)) {
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
      .select("id, full_name, nickname, position, photo_url, verified, cpf_last4, created_at")
      .eq("team_id", team.id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    return { team, athletes: athletes ?? [] };
  });
