import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Lead, MessageTemplate, Niche, ScoreWeights } from "@/lib/prospector";
import { DEFAULT_WEIGHTS } from "@/lib/prospector";

export function useLeads() {
  return useQuery({
    queryKey: ["leads"],
    queryFn: async (): Promise<Lead[]> => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("score", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Lead[];
    },
  });
}

export function useNiches() {
  return useQuery({
    queryKey: ["niches"],
    queryFn: async (): Promise<Niche[]> => {
      const { data, error } = await supabase.from("niches").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as unknown as Niche[];
    },
  });
}

export function useTemplates() {
  return useQuery({
    queryKey: ["templates"],
    queryFn: async (): Promise<MessageTemplate[]> => {
      const { data, error } = await supabase
        .from("message_templates")
        .select("*")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as MessageTemplate[];
    },
  });
}

export type Settings = {
  user_id: string;
  score_weights: ScoreWeights;
  default_city: string;
  default_region: string;
};

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async (): Promise<Settings | null> => {
      const { data, error } = await supabase.from("settings").select("*").maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const row = data as unknown as Settings;
      return { ...row, score_weights: { ...DEFAULT_WEIGHTS, ...(row.score_weights ?? {}) } };
    },
  });
}

export function useInvalidate() {
  const qc = useQueryClient();
  return (keys: string[]) => keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
}