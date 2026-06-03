import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const WO_WINDOW_HOURS = 72;
const WO_SCORE = 3;

/**
 * Aplica WO automático em partidas pendentes há > 72h.
 * - status 'scheduled' (ninguém lançou placar) → WO duplo a favor do mandante (3x0, status='wo').
 * - status 'awaiting_confirmation' (mandante não confirmou) → confirma placar (status='confirmed').
 * Acionado por pg_cron diariamente.
 */
export const Route = createFileRoute("/api/public/hooks/wo-checker")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("apikey");
        if (!apiKey || apiKey !== process.env.SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Unauthorized", { status: 401 });
        }

        const cutoff = new Date(Date.now() - WO_WINDOW_HOURS * 3600_000).toISOString();

        const { data: pending, error } = await supabaseAdmin
          .from("matches")
          .select("id, status, host_team_id, scheduled_at, host_score, visitor_score")
          .in("status", ["scheduled", "awaiting_confirmation"])
          .not("scheduled_at", "is", null)
          .lt("scheduled_at", cutoff);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }

        let woCount = 0;
        let confirmedCount = 0;

        for (const m of pending ?? []) {
          if (m.status === "awaiting_confirmation") {
            const { error: e } = await supabaseAdmin
              .from("matches")
              .update({
                status: "confirmed",
                visitor_confirmed_at: new Date().toISOString(),
              })
              .eq("id", m.id);
            if (!e) confirmedCount++;
          } else if (m.status === "scheduled") {
            const { error: e } = await supabaseAdmin
              .from("matches")
              .update({
                status: "wo",
                host_score: WO_SCORE,
                visitor_score: 0,
                host_filled_at: new Date().toISOString(),
                visitor_confirmed_at: new Date().toISOString(),
              })
              .eq("id", m.id);
            if (!e) woCount++;
          }
        }

        return Response.json({
          ok: true,
          processed: pending?.length ?? 0,
          wo: woCount,
          auto_confirmed: confirmedCount,
        });
      },
    },
  },
});
