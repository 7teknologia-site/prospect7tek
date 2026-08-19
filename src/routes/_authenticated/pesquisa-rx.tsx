import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Activity,
  CheckCircle2,
  Globe,
  Loader2,
  Radar,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { rxSearch } from "@/lib/rx.functions";
import {
  candidateKeys,
  rxScoreBreakdown,
  computeConfidence,
  RX_SITE_STATE,
  EVIDENCE_LABEL,
  CONFIDENCE_LABEL,
  type GeoPlace,
  type RxCandidate,
} from "@/lib/rx";
import { DEFAULT_WEIGHTS, priorityFromScore, formatDate } from "@/lib/prospector";
import { useInvalidate, useLeads, useNiches, useSettings } from "@/hooks/useProspector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/pesquisa-rx")({
  head: () => ({
    meta: [
      { title: "7 Digital RX — Pesquisa de oportunidades locais" },
      {
        name: "description",
        content:
          "Pesquisa, validação e diagnóstico de oportunidades locais com dados públicos do OpenStreetMap.",
      },
      { property: "og:title", content: "7 Digital RX — Pesquisa de oportunidades locais" },
      {
        property: "og:description",
        content: "Descubra, valide e pontue empresas locais antes de adicioná-las aos seus leads.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PesquisaRxPage,
});

const STEPS = ["Descoberta", "Normalização", "Validação", "Score", "Revisão"] as const;

type Scored = RxCandidate & { score: number; items: { label: string; points: number }[] };

function PesquisaRxPage() {
  const search = useServerFn(rxSearch);
  const { data: settings } = useSettings();
  const { data: niches } = useNiches();
  const { data: existingLeads } = useLeads();
  const invalidate = useInvalidate();

  const [segment, setSegment] = useState("salão de beleza");
  const [region, setRegion] = useState("Zona Norte de São Paulo");
  const [neighborhood, setNeighborhood] = useState("");
  const [limit, setLimit] = useState(50);
  const [requirePhone, setRequirePhone] = useState(false);
  const [requireSite, setRequireSite] = useState<"sim" | "nao" | "tanto">("tanto");
  const [minReviews, setMinReviews] = useState(0);
  const [nicheId, setNicheId] = useState<string>("none");

  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(-1);
  const [places, setPlaces] = useState<GeoPlace[]>([]);
  const [placeLabel, setPlaceLabel] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<RxCandidate[]>([]);
  const [stats, setStats] = useState<{ discovered: number; duplicatesRemoved: number } | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [detail, setDetail] = useState<Scored | null>(null);
  const [saving, setSaving] = useState(false);
  const cancelled = useRef(false);

  const weights = settings?.score_weights ?? DEFAULT_WEIGHTS;

  const scored: Scored[] = useMemo(
    () =>
      candidates
        .map((c) => {
          const { score, items } = rxScoreBreakdown(c, weights);
          return { ...c, score, items };
        })
        .filter((c) => (minReviews > 0 ? (c.reviews_count ?? 0) >= minReviews : true))
        .sort((a, b) => b.score - a.score),
    [candidates, weights, minReviews],
  );

  const selectedList = scored.filter((c) => selected[c.key]);

  const summary = useMemo(() => {
    const avg = scored.length
      ? Math.round(scored.reduce((a, b) => a + b.score, 0) / scored.length)
      : 0;
    return {
      found: scored.length,
      dups: stats?.duplicatesRemoved ?? 0,
      withSite: scored.filter((c) => c.site_state === "site_confirmado").length,
      noSite: scored.filter((c) => c.site_state === "sem_evidencia_de_site_na_fonte").length,
      avg,
      top: scored.filter((c) => ["A+", "A"].includes(priorityFromScore(c.score))).length,
    };
  }, [scored, stats]);

  async function runSearch(bbox?: [number, number, number, number]) {
    cancelled.current = false;
    setLoading(true);
    setStep(0);
    setPlaces([]);
    try {
      const timer = setInterval(() => setStep((s) => (s < 3 ? s + 1 : s)), 2500);
      const res = await search({
        data: {
          segment,
          region,
          neighborhood,
          limit,
          requirePhone,
          requireSite,
          ...(bbox ? { bbox } : {}),
        },
      });
      clearInterval(timer);
      if (cancelled.current) return;
      if (res.needsConfirmation) {
        setPlaces(res.places);
        setStep(-1);
        toast.info("Mais de um local encontrado. Confirme a área desejada.");
        return;
      }
      setCandidates(res.candidates as RxCandidate[]);
      setStats(res.stats);
      setPlaceLabel(res.placeLabel);
      setSelected({});
      setStep(4);
      toast.success(`${res.candidates.length} candidatos encontrados no OpenStreetMap.`);
    } catch (err) {
      setStep(-1);
      toast.error(err instanceof Error ? err.message : "Falha na pesquisa. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function addSelected() {
    if (!selectedList.length) return;
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error("Sessão expirada.");

      const existingKeys = (existingLeads ?? []).map((l) => candidateKeys(l));
      let added = 0;
      let existing = 0;
      const rows = [];

      for (const c of selectedList) {
        const k = candidateKeys(c);
        const dup = existingKeys.some(
          (e) =>
            (k.phone && e.phone === k.phone) ||
            (k.domain && e.domain === k.domain) ||
            (k.place && e.place === k.place),
        );
        if (dup) {
          existing++;
          continue;
        }
        existingKeys.push(k);
        const { score } = rxScoreBreakdown(c, weights);
        rows.push({
          user_id: userId,
          company: c.company,
          niche_id: nicheId === "none" ? null : nicheId,
          segment: c.segment,
          subsegment: c.subsegment,
          region: c.region,
          neighborhood: c.neighborhood,
          address: c.address,
          city: c.city,
          state: c.state,
          zip: c.zip,
          phone: c.phone,
          whatsapp: c.whatsapp,
          google_maps_url: c.google_maps_url,
          reviews_count: c.reviews_count,
          rating: c.rating,
          website: c.website,
          website_status: c.website_status,
          instagram: c.instagram,
          linkedin: c.linkedin,
          facebook: c.facebook,
          priority: priorityFromScore(score),
          score,
          opportunity_reason: c.opportunity_reason_preview ?? null,
          status: "novo",
          is_demo: false,
          independent_local: c.independent_local,
          latitude: c.latitude,
          longitude: c.longitude,
          source: c.source,
          source_url: c.source_url,
          notes: placeLabel ? `Área pesquisada: ${placeLabel}` : null,
        });
      }

      if (rows.length) {
        const { error } = await supabase.from("leads").insert(rows as never);
        if (error) throw error;
        added = rows.length;
      }

      const keys = new Set(selectedList.map((c) => c.key));
      setCandidates((prev) => prev.filter((c) => !keys.has(c.key)));
      setSelected({});
      invalidate(["leads"]);
      toast.success(
        `${added} adicionados, ${existing} já existentes, ${selectedList.length - added - existing} ignorados.`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao adicionar leads.");
    } finally {
      setSaving(false);
    }
  }

  function discardSelected() {
    const keys = new Set(selectedList.map((c) => c.key));
    setCandidates((prev) => prev.filter((c) => !keys.has(c.key)));
    setSelected({});
  }

  const allSelected = scored.length > 0 && scored.every((c) => selected[c.key]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Activity className="size-6" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">7 Digital RX</h1>
          <p className="text-sm text-muted-foreground">
            Pesquisa, validação e diagnóstico de oportunidades locais
          </p>
        </div>
        <Badge variant="outline" className="ml-auto gap-1">
          <Globe className="size-3" /> Fonte: OpenStreetMap
        </Badge>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nova pesquisa</CardTitle>
          <CardDescription>
            Dados públicos do OpenStreetMap (Overpass) e geocodificação Nominatim. Campos não
            disponíveis ficam como não identificado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Segmento / nicho</Label>
              <Input value={segment} onChange={(e) => setSegment(e.target.value)} placeholder="salão de beleza" />
            </div>
            <div className="space-y-1.5">
              <Label>Região</Label>
              <Input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="Zona Norte de São Paulo" />
            </div>
            <div className="space-y-1.5">
              <Label>Bairro (opcional)</Label>
              <Input value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} placeholder="Santana" />
            </div>
            <div className="space-y-1.5">
              <Label>Quantidade</Label>
              <Input
                type="number"
                min={1}
                max={200}
                value={limit}
                onChange={(e) => setLimit(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Mínimo de avaliações</Label>
              <Input
                type="number"
                min={0}
                value={minReviews}
                onChange={(e) => setMinReviews(Math.max(0, Number(e.target.value) || 0))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Exigir telefone</Label>
              <Select value={requirePhone ? "sim" : "nao"} onValueChange={(v) => setRequirePhone(v === "sim")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nao">Não</SelectItem>
                  <SelectItem value="sim">Sim</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Exigir site próprio</Label>
              <Select value={requireSite} onValueChange={(v) => setRequireSite(v as typeof requireSite)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tanto">Não importa</SelectItem>
                  <SelectItem value="sim">Sim</SelectItem>
                  <SelectItem value="nao">Não (somente sem site)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Nicho ao importar</Label>
              <Select value={nicheId} onValueChange={setNicheId}>
                <SelectTrigger><SelectValue placeholder="Sem nicho" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem nicho</SelectItem>
                  {(niches ?? []).map((n) => (
                    <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => runSearch()} disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              Pesquisar oportunidades
            </Button>
            {loading && (
              <Button
                variant="outline"
                onClick={() => {
                  cancelled.current = true;
                  setLoading(false);
                  setStep(-1);
                  toast.info("Pesquisa cancelada.");
                }}
              >
                <X className="size-4" /> Cancelar
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={() => {
                setCandidates([]);
                setStats(null);
                setSelected({});
                setStep(-1);
                setPlaces([]);
              }}
            >
              Nova pesquisa
            </Button>
          </div>

          {places.length > 0 && (
            <div className="rounded-lg border border-border p-3">
              <p className="mb-2 text-sm font-medium">Confirme a área geográfica:</p>
              <div className="flex flex-col gap-2">
                {places.map((p) => (
                  <Button
                    key={p.display_name}
                    variant="outline"
                    className="justify-start text-left"
                    onClick={() => {
                      setPlaceLabel(p.display_name);
                      runSearch(p.boundingbox);
                    }}
                  >
                    {p.display_name}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {step >= 0 && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-2 py-4">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <Badge variant={i <= step ? "default" : "outline"} className="gap-1">
                  {i < step ? <CheckCircle2 className="size-3" /> : null}
                  {s}
                </Badge>
                {i < STEPS.length - 1 && <span className="text-muted-foreground">→</span>}
              </div>
            ))}
            {placeLabel && (
              <span className="ml-auto text-xs text-muted-foreground">Área: {placeLabel}</span>
            )}
          </CardContent>
        </Card>
      )}

      {scored.length > 0 && (
        <>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: "Candidatos", value: summary.found },
              { label: "Duplicados removidos", value: summary.dups },
              { label: "Sites encontrados", value: summary.withSite },
              { label: "Site não encontrado na fonte", value: summary.noSite },
              { label: "Score médio", value: summary.avg },
              { label: "Prioridade A+/A", value: summary.top },
            ].map((m) => (
              <Card key={m.label}>
                <CardContent className="py-4">
                  <p className="text-xs text-muted-foreground">{m.label}</p>
                  <p className="font-display text-2xl font-semibold">{m.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="flex-row flex-wrap items-center gap-2 space-y-0">
              <CardTitle className="text-base">Revisão de candidatos</CardTitle>
              <div className="ml-auto flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setSelected(
                      allSelected ? {} : Object.fromEntries(scored.map((c) => [c.key, true])),
                    )
                  }
                >
                  {allSelected ? "Limpar seleção" : "Selecionar todos"}
                </Button>
                <Button size="sm" onClick={addSelected} disabled={!selectedList.length || saving}>
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                  Adicionar selecionados aos Leads ({selectedList.length})
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={discardSelected}
                  disabled={!selectedList.length}
                >
                  <Trash2 className="size-4" /> Descartar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Segmento</TableHead>
                    <TableHead>Bairro</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead>Status do site</TableHead>
                    <TableHead>Confiança</TableHead>
                    <TableHead>Nota</TableHead>
                    <TableHead>Avaliações</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Oportunidade</TableHead>
                    <TableHead>Fonte</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scored.map((c) => (
                    <TableRow
                      key={c.key}
                      className="cursor-pointer"
                      onClick={() => setDetail(c)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={!!selected[c.key]}
                          onCheckedChange={(v) =>
                            setSelected((s) => ({ ...s, [c.key]: Boolean(v) }))
                          }
                        />
                      </TableCell>
                      <TableCell className="font-medium">{c.company}</TableCell>
                      <TableCell>{c.subsegment ?? c.segment ?? "não identificado"}</TableCell>
                      <TableCell>{c.neighborhood ?? "não identificado"}</TableCell>
                      <TableCell>{c.phone ?? "não identificado"}</TableCell>
                      <TableCell className="max-w-[160px] truncate">
                        {c.website ?? "não identificado"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{RX_SITE_STATE[c.site_state]}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {CONFIDENCE_LABEL[c.confidence ?? computeConfidence(c)]}
                        </Badge>
                      </TableCell>
                      <TableCell>{c.rating ?? "Não confirmado"}</TableCell>
                      <TableCell>{c.reviews_count ?? "Não confirmado"}</TableCell>
                      <TableCell className="font-semibold">{c.score}</TableCell>
                      <TableCell>
                        <Badge>{priorityFromScore(c.score)}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[240px] truncate text-xs text-muted-foreground">
                        {c.opportunity_reason_preview ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs">{c.source}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Radar className="size-4" /> {detail.company}
                </DialogTitle>
                <DialogDescription>
                  {detail.address ?? "Endereço não identificado"} · {detail.city ?? "cidade não identificada"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <div className="rounded-lg border border-border p-3">
                  <p className="font-display text-lg font-semibold">Score {detail.score}</p>
                  <ul className="mt-2 space-y-1">
                    {detail.items.map((i) => (
                      <li key={i.label} className="flex justify-between">
                        <span className="text-muted-foreground">{i.label}</span>
                        <span className="font-medium text-primary">+{i.points}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Itens não disponíveis nas fontes públicas não pontuam.
                  </p>
                </div>
                <dl className="grid grid-cols-2 gap-2">
                  {[
                    ["Telefone", detail.phone],
                    ["WhatsApp", detail.whatsapp],
                    ["Site", detail.website],
                    ["Status do site", WEBSITE_STATUS[detail.website_status]],
                    ["Domínio final", detail.website_final_domain],
                    ["Instagram", detail.instagram],
                    ["Facebook", detail.facebook],
                    ["LinkedIn", detail.linkedin],
                    ["Bairro", detail.neighborhood],
                    ["CEP", detail.zip],
                    ["Coordenadas", detail.latitude ? `${detail.latitude}, ${detail.longitude}` : null],
                    ["Independente", detail.independent_local ? "Sim" : "Não (rede/marca)"],
                    ["Coletado em", formatDate(new Date().toISOString())],
                  ].map(([k, v]) => (
                    <div key={String(k)}>
                      <dt className="text-xs text-muted-foreground">{k}</dt>
                      <dd className="break-words">{v ? String(v) : "não identificado"}</dd>
                    </div>
                  ))}
                </dl>
                <p className="text-muted-foreground">{detail.opportunity_reason_preview}</p>
                <div className="flex flex-wrap gap-2">
                  {detail.source_url && (
                    <a href={detail.source_url} target="_blank" rel="noreferrer">
                      <Button variant="outline" size="sm">Ver no {detail.source}</Button>
                    </a>
                  )}
                  {detail.google_maps_url && (
                    <a href={detail.google_maps_url} target="_blank" rel="noreferrer">
                      <Button variant="outline" size="sm">Pesquisar no Google Maps</Button>
                    </a>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
