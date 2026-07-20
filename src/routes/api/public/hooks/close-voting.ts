import { createFileRoute } from "@tanstack/react-router";
import { closeExpiredVotingAndNotify } from "@/lib/mvp-notify.server";

/**
 * Cron: fecha janelas de votação expiradas e enfileira notificações do craque.
 * Protegido por CRON_SECRET (header x-cron-secret).
 */
export const Route = createFileRoute("/api/public/hooks/close-voting")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("x-cron-secret") ?? "";
        const expected = process.env.CRON_SECRET ?? "";
        const a = Buffer.from(provided);
        const b = Buffer.from(expected);
        if (!expected || a.length !== b.length) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { timingSafeEqual } = await import("crypto");
        if (!timingSafeEqual(a, b)) {
          return new Response("Unauthorized", { status: 401 });
        }

        try {
          const result = await closeExpiredVotingAndNotify();
          return Response.json({ ok: true, ...result });
        } catch (err) {
          return new Response(
            JSON.stringify({ error: (err as Error).message }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }
      },
    },
  },
});
