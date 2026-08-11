import type { LeadInput } from "./prospector";
import { WEBSITE_STATUS } from "./prospector";

export function detectDelimiter(text: string): string {
  const line = text.split(/\r?\n/).find((l) => l.trim()) ?? "";
  const counts: Record<string, number> = {
    "\t": (line.match(/\t/g) || []).length,
    ";": (line.match(/;/g) || []).length,
    ",": (line.match(/,/g) || []).length,
  };
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

export function parseDelimited(text: string, delimiter?: string): string[][] {
  const d = delimiter ?? detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === d) {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c === "\r") {
      // ignore
    } else field += c;
  }
  row.push(field);
  rows.push(row);
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

const HEADER_MAP: Record<string, keyof LeadInput> = {
  empresa: "company",
  nome: "company",
  "nome da empresa": "company",
  segmento: "segment",
  nicho: "segment",
  subsegmento: "subsegment",
  regiao: "region",
  bairro: "neighborhood",
  endereco: "address",
  cidade: "city",
  estado: "state",
  uf: "state",
  cep: "zip",
  telefone: "phone",
  fone: "phone",
  whatsapp: "whatsapp",
  "google maps": "google_maps_url",
  maps: "google_maps_url",
  avaliacoes: "reviews_count",
  "avaliacoes google": "reviews_count",
  reviews: "reviews_count",
  nota: "rating",
  "nota google": "rating",
  rating: "rating",
  site: "website",
  website: "website",
  "status do site": "website_status",
  instagram: "instagram",
  linkedin: "linkedin",
  facebook: "facebook",
  observacoes: "notes",
  obs: "notes",
};

function normalizeHeader(h: string) {
  return h
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export type ParsedTable = {
  headers: string[];
  mapped: (keyof LeadInput | null)[];
  rows: LeadInput[];
  rawRowCount: number;
};

export function parseLeadsTable(text: string): ParsedTable {
  const table = parseDelimited(text);
  if (table.length === 0) return { headers: [], mapped: [], rows: [], rawRowCount: 0 };
  const headers = table[0].map((h) => h.trim());
  const mapped = headers.map((h) => HEADER_MAP[normalizeHeader(h)] ?? null);
  const rows: LeadInput[] = [];
  for (const raw of table.slice(1)) {
    const lead: Record<string, unknown> = { company: "" };
    mapped.forEach((key, i) => {
      if (!key) return;
      const value = (raw[i] ?? "").trim();
      if (!value) return;
      if (key === "reviews_count") lead[key] = parseInt(value.replace(/\D/g, "") || "0", 10);
      else if (key === "rating") lead[key] = parseFloat(value.replace(",", "."));
      else if (key === "website_status") {
        const found = Object.entries(WEBSITE_STATUS).find(
          ([k, label]) => k === value || normalizeHeader(label) === normalizeHeader(value),
        );
        lead[key] = found ? found[0] : "nao_verificado";
      } else lead[key] = value;
    });
    if (!lead["whatsapp"] && lead["phone"]) lead["whatsapp"] = lead["phone"];
    if (!lead["website_status"]) lead["website_status"] = lead["website"] ? "site_encontrado" : "nao_verificado";
    rows.push(lead as LeadInput);
  }
  return { headers, mapped, rows, rawRowCount: table.length - 1 };
}