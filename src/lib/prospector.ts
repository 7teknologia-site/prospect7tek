export const WEBSITE_STATUS = {
  nao_verificado: "Não verificado",
  sem_site_confirmado: "Sem site confirmado",
  site_encontrado: "Site encontrado",
  site_invalido: "Site inválido",
} as const;
export type WebsiteStatus = keyof typeof WEBSITE_STATUS;

export const LEAD_STATUS = {
  novo: "Novo",
  qualificado: "Qualificado",
  contatado: "Contatado",
  respondeu: "Respondeu",
  interessado: "Interessado",
  proposta_enviada: "Proposta enviada",
  negociacao: "Negociação",
  cliente: "Cliente",
  sem_interesse: "Sem interesse",
  sem_resposta: "Sem resposta",
  followup: "Follow-up",
  descartado: "Descartado",
} as const;
export type LeadStatus = keyof typeof LEAD_STATUS;

export const PRIORITIES = ["A+", "A", "B", "C"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const CHANNELS = {
  whatsapp: "WhatsApp",
  telefone: "Telefone",
  email: "E-mail",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  presencial: "Presencial",
} as const;

export type ScoreWeights = {
  no_website: number;
  phone: number;
  whatsapp: number;
  reviews_50: number;
  reviews_20: number;
  rating_45: number;
  instagram: number;
  linkedin: number;
  independent: number;
};

export const DEFAULT_WEIGHTS: ScoreWeights = {
  no_website: 30,
  phone: 15,
  whatsapp: 10,
  reviews_50: 15,
  reviews_20: 10,
  rating_45: 10,
  instagram: 5,
  linkedin: 5,
  independent: 10,
};

export type Lead = {
  id: string;
  user_id: string;
  company: string;
  niche_id: string | null;
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
  google_maps_url: string | null;
  reviews_count: number | null;
  rating: number | null;
  website: string | null;
  website_status: WebsiteStatus;
  instagram: string | null;
  linkedin: string | null;
  facebook: string | null;
  priority: Priority;
  score: number;
  opportunity_reason: string | null;
  message: string | null;
  status: LeadStatus;
  collected_at: string;
  contacted_at: string | null;
  followup_at: string | null;
  result: string | null;
  notes: string | null;
  is_demo: boolean;
  independent_local: boolean;
  created_at: string;
  updated_at: string;
};

export type Niche = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  default_message: string | null;
  active: boolean;
  created_at: string;
};

export type MessageTemplate = {
  id: string;
  user_id: string;
  niche_id: string | null;
  title: string;
  content: string;
  active: boolean;
  created_at: string;
};

export type LeadInput = Partial<Lead> & { company: string };

export function computeScore(lead: Partial<Lead>, w: ScoreWeights = DEFAULT_WEIGHTS): number {
  let s = 0;
  if (lead.website_status === "sem_site_confirmado") s += w.no_website;
  if (lead.phone) s += w.phone;
  if (lead.whatsapp) s += w.whatsapp;
  const reviews = lead.reviews_count ?? 0;
  if (reviews >= 50) s += w.reviews_50;
  else if (reviews >= 20) s += w.reviews_20;
  if ((lead.rating ?? 0) >= 4.5) s += w.rating_45;
  if (lead.instagram) s += w.instagram;
  if (lead.linkedin) s += w.linkedin;
  if (lead.independent_local !== false) s += w.independent;
  return Math.max(0, Math.min(100, Math.round(s)));
}

export function priorityFromScore(score: number): Priority {
  if (score >= 80) return "A+";
  if (score >= 60) return "A";
  if (score >= 40) return "B";
  return "C";
}

export function buildOpportunityReason(lead: Partial<Lead>): string {
  const reviews = lead.reviews_count ?? 0;
  const noSite = lead.website_status === "sem_site_confirmado";
  if (noSite && reviews >= 20)
    return `Empresa com ${reviews} avaliações Google e sem site confirmado.`;
  if (noSite && (lead.rating ?? 0) >= 4.5)
    return "Empresa com boa reputação local, mas sem site próprio.";
  if (noSite && lead.instagram) return "Empresa possui Instagram ativo, mas não possui site.";
  if (noSite) return "Empresa sem site confirmado — oportunidade de presença digital própria.";
  if (reviews >= 20)
    return "Empresa possui forte presença no Google e oportunidade de fortalecer presença digital própria.";
  return "Oportunidade de fortalecer a presença digital da empresa.";
}

export function renderTemplate(tpl: string, lead: Partial<Lead>): string {
  return tpl
    .replaceAll("{{empresa}}", lead.company ?? "")
    .replaceAll("{{segmento}}", lead.segment ?? "")
    .replaceAll("{{bairro}}", lead.neighborhood ?? "")
    .replaceAll("{{cidade}}", lead.city ?? "");
}

export function normalizePhone(raw?: string | null): string {
  return (raw ?? "").replace(/\D/g, "");
}

export function whatsappNumber(raw?: string | null): string | null {
  let digits = normalizePhone(raw);
  if (!digits) return null;
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) return "55" + digits;
  if (digits.length > 11) return digits;
  return null;
}

export function whatsappUrl(phone: string | null | undefined, message: string): string | null {
  const n = whatsappNumber(phone);
  if (!n) return null;
  return `https://wa.me/${n}?text=${encodeURIComponent(message)}`;
}

export function siteDomain(url?: string | null): string | null {
  if (!url) return null;
  const cleaned = url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
  return cleaned || null;
}

export function ensureUrl(url?: string | null): string | null {
  if (!url) return null;
  const t = url.trim();
  if (!t) return null;
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

export function dedupeKeys(lead: Partial<Lead>) {
  return {
    phone: normalizePhone(lead.phone) || null,
    domain: siteDomain(lead.website),
    companyPlace: `${(lead.company ?? "").trim().toLowerCase()}|${(lead.neighborhood ?? "").trim().toLowerCase()}`,
  };
}

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("pt-BR");
}