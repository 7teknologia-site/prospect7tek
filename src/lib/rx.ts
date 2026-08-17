import {
  DEFAULT_WEIGHTS,
  normalizePhone,
  siteDomain,
  type Lead,
  type ScoreWeights,
  type WebsiteStatus,
} from "./prospector";

export type RxCandidate = {
  key: string;
  company: string;
  segment: string | null;
  subsegment: string | null;
  region: string | null;
  neighborhood: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  website_status: WebsiteStatus;
  website_final_domain?: string | null;
  instagram: string | null;
  linkedin: string | null;
  facebook: string | null;
  reviews_count: number | null;
  rating: number | null;
  latitude: number | null;
  longitude: number | null;
  independent_local: boolean;
  source: string;
  source_url: string | null;
  google_maps_url: string | null;
  opportunity_reason_preview?: string;
};

export type GeoPlace = {
  display_name: string;
  lat: number;
  lon: number;
  boundingbox: [number, number, number, number]; // south, north, west, east
  type?: string;
};

/** Palavras-chave de segmento -> filtros OSM (chave=valor) */
export const SEGMENT_PRESETS: { label: string; match: string[]; tags: string[] }[] = [
  { label: "Salão de beleza", match: ["salao", "salão", "beleza", "cabelele"], tags: ["shop=hairdresser", "shop=beauty"] },
  { label: "Barbearia", match: ["barbear"], tags: ["shop=hairdresser", "shop=beauty"] },
  { label: "Clínica de estética", match: ["estetica", "estética"], tags: ["shop=beauty", "amenity=clinic"] },
  { label: "Restaurante", match: ["restaurante", "comida"], tags: ["amenity=restaurant"] },
  { label: "Pizzaria", match: ["pizza"], tags: ["amenity=restaurant", "amenity=fast_food"] },
  { label: "Padaria", match: ["padaria", "panific"], tags: ["shop=bakery"] },
  { label: "Lanchonete", match: ["lanchonete", "hamburg", "fast food"], tags: ["amenity=fast_food"] },
  { label: "Cafeteria", match: ["cafe", "café"], tags: ["amenity=cafe"] },
  { label: "Academia", match: ["academia", "fitness", "cross"], tags: ["leisure=fitness_centre"] },
  { label: "Pet shop", match: ["pet", "veterin"], tags: ["shop=pet", "shop=pet_grooming", "amenity=veterinary"] },
  { label: "Odontologia", match: ["dentista", "odonto"], tags: ["amenity=dentist"] },
  { label: "Clínica médica", match: ["clinica", "clínica", "medic", "saude", "saúde"], tags: ["amenity=clinic", "amenity=doctors"] },
  { label: "Advocacia", match: ["advog", "juridic", "jurídic"], tags: ["office=lawyer"] },
  { label: "Contabilidade", match: ["contab"], tags: ["office=accountant"] },
  { label: "Imobiliária", match: ["imobili", "corretor"], tags: ["office=estate_agent"] },
  { label: "Oficina mecânica", match: ["oficina", "mecanic", "mecânic", "auto"], tags: ["shop=car_repair"] },
  { label: "Loja de roupas", match: ["roupa", "moda", "boutique"], tags: ["shop=clothes"] },
  { label: "Farmácia", match: ["farmac", "farmác", "drogaria"], tags: ["amenity=pharmacy"] },
  { label: "Escola / Curso", match: ["escola", "curso", "idioma"], tags: ["amenity=school", "amenity=language_school", "office=educational_institution"] },
  { label: "Mercado", match: ["mercado", "supermerc", "hortifr"], tags: ["shop=supermarket", "shop=convenience", "shop=greengrocer"] },
];

export function tagsForSegment(term: string): string[] {
  const t = stripAccents(term.toLowerCase());
  const hit = SEGMENT_PRESETS.find((p) => p.match.some((m) => t.includes(stripAccents(m))));
  return hit?.tags ?? [];
}

export function stripAccents(v: string): string {
  return v.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeCompany(v: string): string {
  return stripAccents(v.toLowerCase())
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function candidateKeys(c: {
  phone?: string | null;
  website?: string | null;
  company?: string | null;
  neighborhood?: string | null;
  address?: string | null;
}) {
  const phone = normalizePhone(c.phone) || null;
  const domain = siteDomain(c.website);
  const place = normalizeCompany(
    `${c.company ?? ""} ${c.neighborhood || c.address || ""}`.trim(),
  );
  return { phone, domain, place: place || null };
}

export type ScoreItem = { label: string; points: number };

/** Score explicável — usa os mesmos pesos configuráveis do sistema. */
export function scoreBreakdown(
  lead: Partial<Lead>,
  w: ScoreWeights = DEFAULT_WEIGHTS,
): { score: number; items: ScoreItem[] } {
  const items: ScoreItem[] = [];
  if (lead.website_status === "sem_site_confirmado")
    items.push({ label: "Sem site confirmado", points: w.no_website });
  if (lead.phone) items.push({ label: "Telefone disponível", points: w.phone });
  if (lead.whatsapp) items.push({ label: "WhatsApp confirmado", points: w.whatsapp });
  const reviews = lead.reviews_count ?? null;
  if (reviews != null && reviews >= 50)
    items.push({ label: `${reviews} avaliações`, points: w.reviews_50 });
  else if (reviews != null && reviews >= 20)
    items.push({ label: `${reviews} avaliações`, points: w.reviews_20 });
  if (lead.rating != null && lead.rating >= 4.5)
    items.push({ label: `Nota ${lead.rating}`, points: w.rating_45 });
  if (lead.instagram) items.push({ label: "Instagram", points: w.instagram });
  if (lead.linkedin) items.push({ label: "LinkedIn", points: w.linkedin });
  if (lead.independent_local !== false)
    items.push({ label: "Empresa local independente", points: w.independent });
  const raw = items.reduce((a, b) => a + b.points, 0);
  return { score: Math.max(0, Math.min(100, Math.round(raw))), items };
}

/** Motivo de oportunidade baseado apenas em evidências reais. */
export function rxOpportunityReason(c: Partial<RxCandidate>): string {
  const bits: string[] = [];
  if (c.website_status === "sem_site_confirmado") bits.push("não possui site próprio identificado");
  if (c.website_status === "site_invalido") bits.push("site cadastrado não responde");
  if (c.reviews_count != null && c.reviews_count >= 20)
    bits.push(`${c.reviews_count} avaliações registradas`);
  if (c.rating != null && c.rating >= 4.5) bits.push(`nota ${c.rating}`);
  if (c.instagram) bits.push("presença no Instagram");
  if (c.phone) bits.push("telefone público disponível");
  if (!bits.length) return "Dados públicos insuficientes — validação manual necessária.";
  return `Oportunidade: ${bits.join(", ")}.`;
}
