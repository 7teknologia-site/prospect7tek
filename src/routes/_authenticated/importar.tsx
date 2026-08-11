import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { CheckCircle2, FileUp, ListChecks } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useInvalidate, useLeads, useNiches, useSettings } from "@/hooks/useProspector";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { parseLeadsTable } from "@/lib/tabular";
import { ManualImportProvider } from "@/lib/lead-provider";
import {
  DEFAULT_WEIGHTS,
  buildOpportunityReason,
  computeScore,
  dedupeKeys,
  priorityFromScore,
  type Lead,
  type LeadInput,
} from "@/lib/prospector";

export const Route = createFileRoute("/_authenticated/importar")({
  component: ImportPage,
});

const provider = new ManualImportProvider();

type Analyzed = {
  lead: LeadInput;
  state: "novo" | "duplicado" | "invalido";
  errors: string[];
  existingId?: string | undefined;
};

function ImportPage() {
  const { data: leads = [] } = useLeads();
  const { data: niches = [] } = useNiches();
  const { data: settings } = useSettings();
  const invalidate = useInvalidate();

  const [raw, setRaw] = useState("");
  const [analysis, setAnalysis] = useState<Analyzed[] | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [dupMode, setDupMode] = useState<"ignorar" | "atualizar">("ignorar");
  const [nicheId, setNicheId] = useState<string>("none");
  const [region, setRegion] = useState("Zona Norte");
  const [importing, setImporting] = useState(false);

  const weights = settings?.score_weights ?? DEFAULT_WEIGHTS;

  const existingIndex = useMemo(() => {
    const byPhone = new Map<string, string>();
    const byDomain = new Map<string, string>();
    const byCompany = new Map<string, string>();
    leads.forEach((l) => {
      const k = dedupeKeys(l);
      if (k.phone) byPhone.set(k.phone, l.id);
      if (k.domain) byDomain.set(k.domain, l.id);
      byCompany.set(k.companyPlace, l.id);
    });
    return { byPhone, byDomain, byCompany };
  }, [leads]);

  const validate = (text: string) => {
    const parsed = parseLeadsTable(text);
    if (!parsed.rows.length) {
      toast.error("Nenhuma linha detectada. Verifique o cabeçalho e o separador.");
      setAnalysis(null);
      return;
    }
    setHeaders(parsed.headers);
    const seen = new Set<string>();
    const result: Analyzed[] = parsed.rows.map((row) => {
      const lead: LeadInput = {
        ...row,
        region: row.region || region,
        city: row.city || settings?.default_city || "São Paulo",
        state: row.state || "SP",
        niche_id: nicheId === "none" ? null : nicheId,
      };
      const check = provider.validateLead(lead);
      if (!check.valid) return { lead, state: "invalido", errors: check.errors };
      const k = dedupeKeys(lead);
      const existing =
        (k.phone && existingIndex.byPhone.get(k.phone)) ||
        (k.domain && existingIndex.byDomain.get(k.domain)) ||
        existingIndex.byCompany.get(k.companyPlace);
      const dupInBatch =
        (k.phone && seen.has("p:" + k.phone)) || seen.has("c:" + k.companyPlace);
      if (k.phone) seen.add("p:" + k.phone);
      seen.add("c:" + k.companyPlace);
      if (existing || dupInBatch)
        return { lead, state: "duplicado", errors: [], existingId: existing || undefined };
      return { lead, state: "novo", errors: [] };
    });
    setAnalysis(result);
    toast.success(`${result.length} linha(s) analisada(s)`);
  };

  const onFile = async (file: File) => {
    const text = await file.text();
    setRaw(text);
    validate(text);
  };

  const enrich = (lead: LeadInput) => {
    const score = computeScore(lead, weights);
    return {
      ...lead,
      score,
      priority: priorityFromScore(score),
      opportunity_reason: lead.opportunity_reason || buildOpportunityReason(lead),
      segment:
        lead.segment || niches.find((n) => n.id === lead.niche_id)?.name || null,
    } as Partial<Lead>;
  };

  const runImport = async () => {
    if (!analysis) return;
    setImporting(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) {
      setImporting(false);
      toast.error("Sessão expirada");
      return;
    }

    const news = analysis.filter((a) => a.state === "novo").map((a) => ({ ...enrich(a.lead), user_id: uid }));
    const dups = analysis.filter((a) => a.state === "duplicado" && a.existingId);
    let imported = 0;
    let updated = 0;

    if (news.length) {
      const { error } = await supabase.from("leads").insert(news as never);
      if (error) {
        setImporting(false);
        toast.error(error.message);
        return;
      }
      imported = news.length;
    }

    if (dupMode === "atualizar") {
      for (const d of dups) {
        const patch = enrich(d.lead) as Record<string, unknown>;
        delete patch["id"];
        const { error } = await supabase.from("leads").update(patch as never).eq("id", d.existingId!);
        if (!error) updated++;
      }
    }

    await supabase.from("search_jobs").insert({
      user_id: uid,
      provider: provider.id,
      source: "colagem/csv",
      status: "concluido",
      total_rows: analysis.length,
      imported_rows: imported,
      duplicated_rows: analysis.filter((a) => a.state === "duplicado").length,
      invalid_rows: analysis.filter((a) => a.state === "invalido").length,
    } as never);

    setImporting(false);
    invalidate(["leads"]);
    setAnalysis(null);
    setRaw("");
    toast.success(`${imported} novo(s) importado(s)${updated ? `, ${updated} atualizado(s)` : ""}`);
  };

  const counts = {
    novos: analysis?.filter((a) => a.state === "novo").length ?? 0,
    duplicados: analysis?.filter((a) => a.state === "duplicado").length ?? 0,
    invalidos: analysis?.filter((a) => a.state === "invalido").length ?? 0,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Importar Leads</h1>
        <p className="text-sm text-muted-foreground">
          Importe um arquivo CSV ou cole uma lista tabular. Nenhuma coleta automática é feita nesta
          versão.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">Origem dos dados</CardTitle>
          <CardDescription>
            Colunas aceitas: Empresa, Segmento, Região, Bairro, Telefone, Avaliações, Nota, Site,
            Instagram, LinkedIn.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nicho aplicado à importação</Label>
              <Select value={nicheId} onValueChange={setNicheId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem nicho</SelectItem>
                  {niches.map((n) => (
                    <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Região padrão</Label>
              <Input value={region} onChange={(e) => setRegion(e.target.value)} />
            </div>
          </div>

          <Tabs defaultValue="colar">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="colar">Colar dados</TabsTrigger>
              <TabsTrigger value="csv">Arquivo CSV</TabsTrigger>
            </TabsList>
            <TabsContent value="colar" className="pt-4">
              <Textarea
                rows={10}
                className="font-mono text-xs"
                placeholder={"Empresa;Segmento;Bairro;Telefone;Avaliações;Nota;Site;Instagram\nStudio X;Estética;Santana;11999998888;87;4.8;;https://instagram.com/studiox"}
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
              />
            </TabsContent>
            <TabsContent value="csv" className="pt-4">
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-10 text-sm text-muted-foreground hover:bg-muted/40">
                <FileUp className="size-6" />
                Selecionar arquivo CSV
                <input
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onFile(f);
                  }}
                />
              </label>
            </TabsContent>
          </Tabs>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => validate(raw)} disabled={!raw.trim()}>
              <ListChecks className="size-4" /> Validar
            </Button>
            <Button onClick={runImport} disabled={!analysis || importing}>
              <CheckCircle2 className="size-4" /> {importing ? "Importando..." : "Importar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {analysis && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base">Pré-visualização</CardTitle>
            <CardDescription>
              {analysis.length} linha(s) · campos detectados: {headers.join(", ") || "—"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-success text-success-foreground">Novos: {counts.novos}</Badge>
              <Badge className="bg-warning text-warning-foreground">Duplicados: {counts.duplicados}</Badge>
              <Badge variant="destructive">Inválidos: {counts.invalidos}</Badge>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Ao encontrar duplicados</Label>
              <Select value={dupMode} onValueChange={(v) => setDupMode(v as "ignorar" | "atualizar")}>
                <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ignorar">Ignorar duplicados</SelectItem>
                  <SelectItem value="atualizar">Atualizar registro existente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="max-h-96 overflow-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Situação</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Bairro</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Aval.</TableHead>
                    <TableHead>Nota</TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead>Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analysis.slice(0, 200).map((a, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">
                        {a.state === "novo" && <span className="text-success">Novo</span>}
                        {a.state === "duplicado" && <span className="text-warning">Duplicado</span>}
                        {a.state === "invalido" && (
                          <span className="text-destructive">{a.errors.join(", ")}</span>
                        )}
                      </TableCell>
                      <TableCell>{a.lead.company || "—"}</TableCell>
                      <TableCell>{a.lead.neighborhood ?? "—"}</TableCell>
                      <TableCell>{a.lead.phone ?? "—"}</TableCell>
                      <TableCell>{a.lead.reviews_count ?? 0}</TableCell>
                      <TableCell>{a.lead.rating ?? "—"}</TableCell>
                      <TableCell className="max-w-40 truncate">{a.lead.website ?? "—"}</TableCell>
                      <TableCell>{computeScore(a.lead, weights)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}