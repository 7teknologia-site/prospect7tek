import { ensureUrl, siteDomain } from "./prospector";
import {
  candidateKeys,
  computeConfidence,
  makeEvidence,
  normalizeCompany,
  rxOpportunityReason,
  siteStateToWebsiteStatus,
  tagsForSegment,
  type GeoPlace,
  type RxEvidence,
  type RxSiteState,
  type RxCandidate,
} from "./rx";

const UA = "7DigitalRX/1.0 (lead prospecting; contact via app)";
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const NOT_OWN_SITE = [
  "instagram.com",
  "facebook.com",
  "fb.com",
  "linkedin.com",
  "linktr.ee",
  "linktree.com",
  "wa.me",
  "api.whatsapp.com",
  "whatsapp.com",
  "youtube.com",
  "tiktok.com",
  "twitter.com",
  "x.com",
  "google.com",
  "goo.gl",
  "maps.app.goo.gl",
  "beacons.ai",
  "bio.link",
  "ifood.com.br",
  "sympla.com.br",
  "doctoralia.com.br",
  "booksy.com",
  "telefonesbrasil.com.br",
  "apontador.com.br",
  "guiamais.com.br",
  "yelp.com",
];

function isSocialOrDirectory(url: string): boolean {
  const d = siteDomain(url) ?? "";
  return NOT_OWN_SITE.some((s) => d === s || d.endsWith("." + s));
}

function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (h === "0.0.0.0" || h === "::1" || h === "[::1]") return true;
  if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (/^169\.254\./.test(h)) return true;
  return false;
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

export async function geocodePlaces(query: string): Promise<GeoPlace[]> {
  const url =
    "https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=0&limit=5&countrycodes=br&q=" +
    encodeURIComponent(query);
  const res = await fetchWithTimeout(
    url,
    { headers: { "User-Agent": UA, Accept: "application/json" } },
    12000,
  );
  if (!res.ok) throw new Error("Nominatim indisponível no momento. Tente novamente.");
  const json = (await res.json()) as Array<{
    display_name: string;
    lat: string;
    lon: string;
    boundingbox: [string, string, string, string];
    type?: string;
  }>;
  return json.map((r) => ({
    display_name: r.display_name,
    lat: Number(r.lat),
    lon: Number(r.lon),
    boundingbox: r.boundingbox.map(Number) as [number, number, number, number],
    ...(r.type ? { type: r.type } : {}),
  }));
}

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

export async function overpassSearch(
  bbox: [number, number, number, number],
  tags: string[],
  limit: number,
): Promise<OverpassElement[]> {
  const [south, north, west, east] = bbox;
  const bb = `${south},${west},${north},${east}`;
  const parts = tags
    .map((t) => {
      const [k, v] = t.split("=");
      return `nwr["${k}"="${v}"](${bb});`;
    })
    .join("\n");
  const q = `[out:json][timeout:50];(${parts});out center tags ${Math.min(Math.max(limit * 4, 60), 400)};`;

  let lastError: unknown;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetchWithTimeout(
        endpoint,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA },
          body: "data=" + encodeURIComponent(q),
        },
        55000,
      );
      if (!res.ok) throw new Error(`Overpass ${res.status}`);
      const json = (await res.json()) as { elements?: OverpassElement[] };
      return json.elements ?? [];
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(
    "Overpass API indisponível no momento. Tente novamente em alguns instantes." +
      (lastError instanceof Error ? ` (${lastError.message})` : ""),
  );
}

function pick(tags: Record<string, string>, keys: string[]): string | null {
  for (const k of keys) if (tags[k]?.trim()) return tags[k].trim();
  return null;
}

function socialUrl(base: string, value: string | null): string | null {
  if (!value) return null;
  const v = value.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${base}/${v.replace(/^@/, "")}`;
}

export function elementToCandidate(
  el: OverpassElement,
  ctx: { segment: string; region: string | null },
): RxCandidate | null {
  const tags = el.tags ?? {};
  const company = pick(tags, ["name", "operator", "brand"]);
  if (!company) return null;

  const lat = el.lat ?? el.center?.lat ?? null;
  const lon = el.lon ?? el.center?.lon ?? null;

  const street = pick(tags, ["addr:street"]);
  const number = pick(tags, ["addr:housenumber"]);
  const address = street ? [street, number].filter(Boolean).join(", ") : null;

  const rawWebsite = pick(tags, ["website", "contact:website", "url"]);
  let website = ensureUrl(rawWebsite);
  let facebook = socialUrl("facebook.com", pick(tags, ["contact:facebook", "facebook"]));
  const instagram = socialUrl("instagram.com", pick(tags, ["contact:instagram", "instagram"]));
  const linkedin = socialUrl("linkedin.com/company", pick(tags, ["contact:linkedin", "linkedin"]));

  if (website && isSocialOrDirectory(website)) {
    const d = siteDomain(website) ?? "";
    if (d.includes("facebook")) facebook = facebook ?? website;
    website = null;
  }

  const phone = pick(tags, ["phone", "contact:phone", "contact:mobile", "mobile"]);
  const whatsapp = pick(tags, ["contact:whatsapp", "whatsapp"]);

  const osmUrl = `https://www.openstreetmap.org/${el.type}/${el.id}`;
  const mapsQuery = encodeURIComponent(
    `${company} ${address ?? ""} ${tags["addr:city"] ?? ""}`.trim(),
  );

  const now = new Date().toISOString();
  const src = "OpenStreetMap";
  const site_state: RxSiteState = website
    ? "site_nao_confirmado"
    : "sem_evidencia_de_site_na_fonte";
  const independent = !tags["brand"] && !tags["brand:wikidata"];

  const ev = (field: string, label: string, value: string | null): RxEvidence =>
    value
      ? makeEvidence(field, label, value, "confirmado", src, osmUrl, now)
      : makeEvidence(field, label, null, "ausente_na_fonte", null, null, now);

  const evidence: RxEvidence[] = [
    makeEvidence("company", "Nome da empresa", company, "confirmado", src, osmUrl, now),
    ev("phone", "Telefone", phone),
    ev("whatsapp", "WhatsApp", whatsapp),
    ev("instagram", "Instagram", instagram),
    ev("linkedin", "LinkedIn", linkedin),
    ev("facebook", "Facebook", facebook),
    ev("address", "Endereço", address),
    website
      ? makeEvidence("website", "Site", website, "nao_confirmado", src, osmUrl, now)
      : makeEvidence("website", "Site", null, "ausente_na_fonte", null, null, now),
    makeEvidence(
      "independent_local",
      "Empresa local independente",
      independent ? "Sem marca/rede declarada na fonte" : "Marca/rede declarada",
      independent ? "confirmado" : "nao_confirmado",
      src,
      osmUrl,
      now,
    ),
    makeEvidence("rating", "Nota (Google)", null, "ausente_na_fonte", null, null, now),
    makeEvidence("reviews_count", "Avaliações (Google)", null, "ausente_na_fonte", null, null, now),
  ];

  const candidate: RxCandidate = {
    key: `${el.type}/${el.id}`,
    company,
    segment: ctx.segment,
    subsegment: pick(tags, ["shop", "amenity", "office", "leisure"]),
    region: ctx.region,
    neighborhood: pick(tags, ["addr:suburb", "addr:neighbourhood", "addr:district"]),
    address,
    city: pick(tags, ["addr:city"]),
    state: pick(tags, ["addr:state"]),
    zip: pick(tags, ["addr:postcode"]),
    phone,
    whatsapp,
    website,
    site_state,
    website_status: siteStateToWebsiteStatus(site_state),
    instagram,
    linkedin,
    facebook,
    reviews_count: null,
    rating: null,
    latitude: lat,
    longitude: lon,
    independent_local: independent,
    source: src,
    source_url: osmUrl,
    google_maps_url: `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`,
    evidence,
  };
  candidate.confidence = computeConfidence(candidate);
  return candidate;
}

/** Valida uma URL de site com proteção contra SSRF. */
export async function validateSiteUrl(
  rawUrl: string,
): Promise<{ state: RxSiteState; finalDomain: string | null }> {
  const normalized = ensureUrl(rawUrl);
  if (!normalized) return { state: "sem_evidencia_de_site_na_fonte", finalDomain: null };
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return { state: "site_invalido", finalDomain: null };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
    return { state: "site_invalido", finalDomain: null };
  if (isPrivateHost(parsed.hostname)) return { state: "site_invalido", finalDomain: null };
  if (isSocialOrDirectory(parsed.href))
    return { state: "sem_evidencia_de_site_na_fonte", finalDomain: null };

  let current = parsed.href;
  for (let hop = 0; hop < 3; hop++) {
    try {
      const res = await fetchWithTimeout(
        current,
        { method: "GET", redirect: "manual", headers: { "User-Agent": UA } },
        8000,
      );
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) return { state: "site_invalido", finalDomain: siteDomain(current) };
        const next = new URL(loc, current);
        if (next.protocol !== "http:" && next.protocol !== "https:")
          return { state: "site_invalido", finalDomain: null };
        if (isPrivateHost(next.hostname)) return { state: "site_invalido", finalDomain: null };
        if (isSocialOrDirectory(next.href))
          return { state: "sem_evidencia_de_site_na_fonte", finalDomain: siteDomain(next.href) };
        current = next.href;
        continue;
      }
      if (res.status >= 200 && res.status < 400)
        return { state: "site_confirmado", finalDomain: siteDomain(current) };
      if (res.status === 403 || res.status === 405)
        return { state: "dominio_bloqueou_verificacao", finalDomain: siteDomain(current) };
      return { state: "site_invalido", finalDomain: siteDomain(current) };
    } catch {
      return { state: "site_invalido", finalDomain: siteDomain(current) };
    }
  }
  return { state: "site_invalido", finalDomain: siteDomain(current) };
}

/** Deduplica candidatos entre si. */
export function dedupeCandidates(list: RxCandidate[]): { kept: RxCandidate[]; removed: number } {
  const seenPhone = new Set<string>();
  const seenDomain = new Set<string>();
  const seenPlace = new Set<string>();
  const kept: RxCandidate[] = [];
  let removed = 0;
  for (const c of list) {
    const k = candidateKeys(c);
    const dup =
      (k.phone && seenPhone.has(k.phone)) ||
      (k.domain && seenDomain.has(k.domain)) ||
      (k.place && seenPlace.has(k.place)) ||
      seenPlace.has(normalizeCompany(c.company));
    if (dup) {
      removed++;
      continue;
    }
    if (k.phone) seenPhone.add(k.phone);
    if (k.domain) seenDomain.add(k.domain);
    if (k.place) seenPlace.add(k.place);
    kept.push(c);
  }
  return { kept, removed };
}

export { rxOpportunityReason, tagsForSegment };
