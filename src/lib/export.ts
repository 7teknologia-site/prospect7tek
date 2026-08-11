import * as XLSX from "xlsx";
import type { Lead, Niche } from "./prospector";
import { LEAD_STATUS, WEBSITE_STATUS, formatDate } from "./prospector";

export function leadsToRows(leads: Lead[], niches: Niche[]) {
  const nicheName = (id: string | null) => niches.find((n) => n.id === id)?.name ?? "";
  return leads.map((l) => ({
    ID: l.id,
    Empresa: l.company,
    Segmento: l.segment || nicheName(l.niche_id),
    Subsegmento: l.subsegment ?? "",
    "Região": l.region ?? "",
    Bairro: l.neighborhood ?? "",
    "Endereço": l.address ?? "",
    Telefone: l.phone ?? "",
    WhatsApp: l.whatsapp ?? "",
    "Avaliações": l.reviews_count ?? 0,
    Nota: l.rating ?? "",
    Site: l.website ?? "",
    "Status do site": WEBSITE_STATUS[l.website_status] ?? l.website_status,
    Instagram: l.instagram ?? "",
    LinkedIn: l.linkedin ?? "",
    Facebook: l.facebook ?? "",
    Score: l.score,
    Prioridade: l.priority,
    "Motivo da oportunidade": l.opportunity_reason ?? "",
    Mensagem: l.message ?? "",
    "Status comercial": LEAD_STATUS[l.status] ?? l.status,
    "Data da coleta": formatDate(l.collected_at),
    "Data do contato": formatDate(l.contacted_at),
    "Data do follow-up": formatDate(l.followup_at),
    Resultado: l.result ?? "",
    "Observações": l.notes ?? "",
  }));
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportXlsx(leads: Lead[], niches: Niche[], filename = "leads.xlsx") {
  const ws = XLSX.utils.json_to_sheet(leadsToRows(leads, niches));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Leads");
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  download(new Blob([out], { type: "application/octet-stream" }), filename);
}

export function exportCsv(leads: Lead[], niches: Niche[], filename = "leads.csv") {
  const rows = leadsToRows(leads, niches);
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const escape = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const csv = [headers.join(";"), ...rows.map((r) => headers.map((h) => escape((r as Record<string, unknown>)[h])).join(";"))].join("\n");
  download(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }), filename);
}