import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Get current user's profile + email
export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, phone")
      .eq("id", userId)
      .maybeSingle();
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
    return {
      full_name: profile?.full_name ?? "",
      phone: profile?.phone ?? "",
      email: authUser?.user?.email ?? "",
    };
  });

const updateSchema = z.object({
  full_name: z.string().trim().min(3).max(120),
  phone: z.string().trim().regex(/^\d{10,11}$/, "WhatsApp deve ter DDD + número"),
  email: z.string().email().max(255),
});

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => updateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { error: pErr } = await supabaseAdmin
      .from("profiles")
      .update({ full_name: data.full_name, phone: data.phone })
      .eq("id", userId);
    if (pErr) throw new Error(pErr.message);

    // Update e-mail if changed
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (authUser?.user?.email !== data.email) {
      const { error: eErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        email: data.email,
      });
      if (eErr) throw new Error(eErr.message);
    }

    return { success: true };
  });
