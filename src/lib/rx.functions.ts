import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const rxGeocode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ query: z.string().min(2).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const { geocodePlaces } = await import("./rx.server");
    return { places: await geocodePlaces(data.query) };
  });

export const rxSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        segment: z.string().min(2).max(120),
        region: z.string().max(200).optional().default(""),
        neighborhood: z.string().max(120).optional().default(""),
        limit: z.number().int().min(1).max(200).default(50),
        requirePhone: z.boolean().default(false),
        requireSite: z.enum(["sim", "nao", "tanto"]).default("tanto"),
        bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const {
      geocodePlaces,
      overpassSearch,
      elementToCandidate,
      dedupeCandidates,
      validateSiteUrl,
      rxOpportunityReason,
      tagsForSegment,
    } = await import("./rx.server");

    let bbox = data.bbox;
    let placeLabel: string | null = null;

    if (!bbox) {
      const q = [data.neighborhood, data.region].filter(Boolean).join(", ");
      if (!q) throw new Error("Informe a região da pesquisa.");
      const places = await geocodePlaces(q);
      if (!places.length) throw new Error(`Não foi possível localizar "${q}". Tente outro texto.`);
      if (places.length > 1) {
        return {
          needsConfirmation: true as const,
          places,
          candidates: [],
          stats: null,
          placeLabel: null,
        };
      }
      const place = places[0]!;
      bbox = place.boundingbox;
      placeLabel = place.display_name;
    }

    const tags = tagsForSegment(data.segment);
    if (!tags.length)
      throw new Error(
        "Segmento não reconhecido para busca automática. Use termos como 'salão de beleza', 'restaurante', 'pet shop'.",
      );

    const elements = await overpassSearch(bbox, tags, data.limit);
    const ctx = { segment: data.segment, region: data.region || null };
    const raw = elements
      .map((el) => elementToCandidate(el, ctx))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));

    const { computeConfidence, siteStateToWebsiteStatus } = await import("./rx");
    const { kept, removed } = dedupeCandidates(raw);

    let filtered = kept;
    if (data.requirePhone) filtered = filtered.filter((c) => Boolean(c.phone));
    if (data.requireSite === "sim") filtered = filtered.filter((c) => Boolean(c.website));
    if (data.requireSite === "nao") filtered = filtered.filter((c) => !c.website);

    const selected = filtered.slice(0, data.limit);

    // Validação de sites em lotes pequenos (respeita limites e evita travar).
    const batch = 5;
    for (let i = 0; i < selected.length; i += batch) {
      await Promise.all(
        selected.slice(i, i + batch).map(async (c) => {
          if (!c.website) {
            c.site_state = "sem_evidencia_de_site_na_fonte";
          } else {
            const r = await validateSiteUrl(c.website);
            c.site_state = r.state;
            c.website_final_domain = r.finalDomain;
          }
          c.website_status = siteStateToWebsiteStatus(c.site_state);
          const evi = c.evidence.find((e) => e.field === "website");
          if (evi) {
            evi.status =
              c.site_state === "site_confirmado"
                ? "confirmado"
                : c.site_state === "sem_evidencia_de_site_na_fonte"
                  ? "ausente_na_fonte"
                  : "nao_confirmado";
            evi.checked_at = new Date().toISOString();
          }
          c.confidence = computeConfidence(c);
        }),
      );
    }

    for (const c of selected) c.opportunity_reason_preview = rxOpportunityReason(c);

    return {
      needsConfirmation: false as const,
      places: [],
      placeLabel,
      candidates: selected,
      stats: {
        discovered: raw.length,
        duplicatesRemoved: removed,
        withSite: selected.filter((c) => c.site_state === "site_confirmado").length,
        withoutSite: selected.filter((c) => c.site_state === "sem_evidencia_de_site_na_fonte")
          .length,
      },
    };
  });
