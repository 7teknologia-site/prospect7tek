import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Prospector 7TEKNOLOGIA — Prospecção de leads locais" },
      {
        name: "description",
        content:
          "Importe, qualifique e organize leads de empresas locais da Zona Norte de São Paulo para prospecção de criação de sites.",
      },
      { property: "og:title", content: "Prospector 7TEKNOLOGIA — Prospecção de leads locais" },
      {
        property: "og:description",
        content: "Importe, qualifique e organize leads de empresas locais da Zona Norte de São Paulo para prospecção de criação de sites.",
      },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
  component: () => null,
});
