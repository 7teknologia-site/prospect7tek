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
  /** Estado semântico detalhado do site (fonte de verdade do RX). */
  site_state: RxSiteState;
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
  evidence: RxEvidence[];
  confidence?: RxConfidence;
  opportunity_reason_preview?: string;
};

/** Estados de site — ausência na fonte NÃO é prova de inexistência de site. */
export const RX_SITE_STATE = {
  site_confirmado: "Site confirmado",
  site_nao_confirmado: "Site não confirmado",
  sem_evidencia_de_site_na_fonte: "Não encontrado na fonte consultada",
  dominio_bloqueou_verificacao: "Domínio respondeu / bloqueou verificação",
  site_invalido: "URL inválida ou fora do ar",
} as const;
export type RxSiteState = keyof typeof RX_SITE_STATE;

/** Compatibilidade com a coluna website_status existente no banco. */
export function siteStateToWebsiteStatus(state: RxSiteState): WebsiteStatus {
  if (state === "site_confirmado") return "site_encontrado";
  if (state === "site_invalido") return "site_invalido";
  return "nao_verificado";
}

export type EvidenceStatus = "confirmado" | "nao_confirmado" | "ausente_na_fonte";

export const EVIDENCE_LABEL: Record<EvidenceStatus, string> = {
  confirmado: "Confirmado",
  nao_confirmado: "Não confirmado",
  ausente_na_fonte: "Não encontrado na fonte consultada",
};

export type RxEvidence = {
  field: string;
  label: string;
  value: string | null;
  status: EvidenceStatus;
  source: string | null;
  source_url: string | null;
  checked_at: string;
};

export type RxConfidence = "alto" | "medio" | "baixo";

export const CONFIDENCE_LABEL: Record<RxConfidence, string> = {
  alto: "Alta confiança",
  medio: "Confiança média",
  baixo: "Baixa confiança",
};

export function makeEvidence(
  field: string,
  label: string,
  value: string | null,
  status: EvidenceStatus,
  source: string | null,
  source_url: string | null,
  checked_at = new Date().toISOString(),
): RxEvidence {
  return { field, label, value, status, source, source_url, checked_at };
}

export function evidenceOf(c: Pick<RxCandidate, "evidence">, field: string): RxEvidence | null {
  return c.evidence?.find((e) => e.field === field) ?? null;
}

export function isConfirmed(c: Pick<RxCandidate, "evidence">, field: string): boolean {
  return evidenceOf(c, field)?.status === "confirmado";
}

/** Nível de confiança pela quantidade/qualidade de evidências confirmadas. */
export function computeConfidence(c: Pick<RxCandidate, "evidence" | "site_state">): RxConfidence {
  const confirmed = (c.evidence ?? []).filter((e) => e.status === "confirmado").length;
  const siteResolved = c.site_state === "site_confirmado" || c.site_state === "site_invalido";
  if (confirmed >= 4 && siteResolved) return "alto";
  if (confirmed >= 2) return "medio";
  return "baixo";
}

/** Score do RX: pontua SOMENTE evidências confirmadas; ausência = 0, nunca penalidade. */
export function rxScoreBreakdown(
  c: RxCandidate,
  w: ScoreWeights = DEFAULT_WEIGHTS,
): { score: number; items: ScoreItem[] } {
  const items: ScoreItem[] = [];
  if (c.site_state === "site_invalido")
    items.push({ label: "Site cadastrado não responde (confirmado)", points: w.no_website });
  if (isConfirmed(c, "phone")) items.push({ label: "Telefone confirmado na fonte", points: w.phone });
  if (isConfirmed(c, "whatsapp")) items.push({ label: "WhatsApp confirmado na fonte", points: w.whatsapp });
  if (isConfirmed(c, "reviews_count") && (c.reviews_count ?? 0) >= 50)
    items.push({ label: `${c.reviews_count} avaliações confirmadas`, points: w.reviews_50 });
  else if (isConfirmed(c, "reviews_count") && (c.reviews_count ?? 0) >= 20)
    items.push({ label: `${c.reviews_count} avaliações confirmadas`, points: w.reviews_20 });
  if (isConfirmed(c, "rating") && (c.rating ?? 0) >= 4.5)
    items.push({ label: `Nota ${c.rating} confirmada`, points: w.rating_45 });
  if (isConfirmed(c, "instagram")) items.push({ label: "Instagram confirmado", points: w.instagram });
  if (isConfirmed(c, "linkedin")) items.push({ label: "LinkedIn confirmado", points: w.linkedin });
  if (isConfirmed(c, "independent_local"))
    items.push({ label: "Empresa local independente (sem marca/rede na fonte)", points: w.independent });
  const raw = items.reduce((a, b) => a + b.points, 0);
  return { score: Math.max(0, Math.min(100, Math.round(raw))), items };
}

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
  if (c.site_state === "site_invalido") bits.push("site cadastrado não responde (verificado)");
  if (c.site_state === "sem_evidencia_de_site_na_fonte")
    bits.push("nenhum site encontrado na fonte consultada (não confirma ausência de site)");
  if (c.reviews_count != null && c.reviews_count >= 20)
    bits.push(`${c.reviews_count} avaliações registradas`);
  if (c.rating != null && c.rating >= 4.5) bits.push(`nota ${c.rating}`);
  if (c.instagram) bits.push("presença no Instagram");
  if (c.phone) bits.push("telefone público disponível");
  if (!bits.length) return "Oportunidade ainda não confirmada — validação manual necessária.";
  return `Oportunidade: ${bits.join(", ")}.`;
}
