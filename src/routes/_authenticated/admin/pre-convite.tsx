import { createFileRoute } from "@tanstack/react-router";
import { ConviteFlyerPage } from "@/routes/convite-flyer";

export const Route = createFileRoute("/_authenticated/admin/pre-convite")({
  component: ConviteFlyerPage,
  head: () => ({
    meta: [
      { title: "Pré-convite — Admin Liga Metrópole" },
      {
        name: "description",
        content:
          "Crie o convite oficial personalizado do clube para a Liga Metrópole.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
});
