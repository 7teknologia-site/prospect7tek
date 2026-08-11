import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useInvalidate, useSettings } from "@/hooks/useProspector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DEFAULT_WEIGHTS, type ScoreWeights } from "@/lib/prospector";

export const Route = createFileRoute("/_authenticated/configuracoes")({ component: SettingsPage });

const LABELS: Record<keyof ScoreWeights, string> = {
  no_website: "Sem site confirmado",
  phone: "Telefone disponível",
  whatsapp: "WhatsApp disponível",
  reviews_50: "50+ avaliações",
  reviews_20: "20 a 49 avaliações",
  rating_45: "Nota ≥ 4,5",
  instagram: "Instagram encontrado",
  linkedin: "LinkedIn encontrado",
  independent: "Empresa local independente",
};

function SettingsPage() {
  const { data: settings } = useSettings();
  const invalidate = useInvalidate();
  const [weights, setWeights] = useState<ScoreWeights>(DEFAULT_WEIGHTS);
  const [city, setCity] = useState("São Paulo");
  const [region, setRegion] = useState("Zona Norte");

  useEffect(() => {
    if (settings) {
      setWeights(settings.score_weights);
      setCity(settings.default_city);
      setRegion(settings.default_region);
    }
  }, [settings]);

  const save = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("settings").upsert({
      user_id: u.user.id,
      score_weights: weights,
      default_city: city,
      default_region: region,
    } as never);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Configurações salvas");
    invalidate(["settings"]);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Configurações</h1>
        <p className="text-sm text-muted-foreground">Pesos do score e padrões de importação.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">Pesos do score (0 a 100)</CardTitle>
          <CardDescription>Usados no cálculo automático de score e prioridade.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.keys(LABELS) as (keyof ScoreWeights)[]).map((k) => (
            <div key={k} className="space-y-1.5">
              <Label className="text-xs">{LABELS[k]}</Label>
              <Input
                type="number"
                value={weights[k]}
                onChange={(e) => setWeights({ ...weights, [k]: Number(e.target.value) })}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">Padrões</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Cidade padrão</Label>
            <Input value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Região padrão</Label>
            <Input value={region} onChange={(e) => setRegion(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">Fonte de leads</CardTitle>
          <CardDescription>
            Provider ativo: Importação manual. A arquitetura está preparada para novos providers
            automáticos no futuro.
          </CardDescription>
        </CardHeader>
      </Card>

      <Button onClick={save}>Salvar configurações</Button>
    </div>
  );
}