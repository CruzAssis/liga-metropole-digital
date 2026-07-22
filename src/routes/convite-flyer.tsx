import { createFileRoute } from "@tanstack/react-router";
import { ConviteFlyerPage } from "@/components/ConviteFlyerPage";

export const Route = createFileRoute("/convite-flyer")({
  component: ConviteFlyerPage,
  head: () => ({
    meta: [
      { title: "Customizador de Convites — Liga Metrópole" },
      {
        name: "description",
        content:
          "Monte o convite oficial da Liga Metrópole com o escudo do seu clube, subprefeitura e mando de campo. Exporte em PNG alta resolução.",
      },
      { property: "og:title", content: "Customizador de Convites — Liga Metrópole" },
      {
        property: "og:description",
        content:
          "Editor dark premium para gerar convites personalizados da Liga Metrópole.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});
