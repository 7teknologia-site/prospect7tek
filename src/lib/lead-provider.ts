import type { Lead, LeadInput } from "./prospector";
import { buildOpportunityReason, computeScore, priorityFromScore } from "./prospector";

/**
 * Camada de abstração para futuras fontes automáticas de leads.
 * Nesta versão apenas o ManualImportProvider está disponível.
 */
export interface LeadProvider {
  readonly id: string;
  readonly label: string;
  searchBusinesses(query: SearchQuery): Promise<LeadInput[]>;
  getBusinessDetails(externalId: string): Promise<LeadInput | null>;
  validateWebsite(url: string | null): Promise<Lead["website_status"]>;
  findSocialProfiles(lead: LeadInput): Promise<{ instagram?: string; linkedin?: string; facebook?: string }>;
  validateLead(lead: LeadInput): { valid: boolean; errors: string[] };
}

export type SearchQuery = {
  term?: string;
  region?: string;
  neighborhood?: string;
  city?: string;
  rows?: LeadInput[];
};

export class ManualImportProvider implements LeadProvider {
  readonly id = "manual_import";
  readonly label = "Importação manual";

  async searchBusinesses(query: SearchQuery): Promise<LeadInput[]> {
    return (query.rows ?? []).map((row) => this.enrich(row));
  }

  async getBusinessDetails(): Promise<LeadInput | null> {
    return null;
  }

  async validateWebsite(url: string | null): Promise<Lead["website_status"]> {
    // Sem verificação automática nesta versão: o usuário confirma manualmente.
    return url && url.trim() ? "site_encontrado" : "nao_verificado";
  }

  async findSocialProfiles() {
    return {};
  }

  validateLead(lead: LeadInput) {
    const errors: string[] = [];
    if (!lead.company || !lead.company.trim()) errors.push("Empresa é obrigatória");
    if (lead.rating != null && (lead.rating < 0 || lead.rating > 5)) errors.push("Nota inválida");
    if (lead.reviews_count != null && lead.reviews_count < 0) errors.push("Avaliações inválidas");
    return { valid: errors.length === 0, errors };
  }

  enrich(lead: LeadInput): LeadInput {
    const score = computeScore(lead);
    return {
      ...lead,
      score,
      priority: priorityFromScore(score),
      opportunity_reason: lead.opportunity_reason || buildOpportunityReason(lead),
    };
  }
}

export const leadProviders: LeadProvider[] = [new ManualImportProvider()];
export const activeProvider = leadProviders[0];