import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ArrowUpDown,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Instagram,
  Linkedin,
  MessageCircle,
  Search,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useInvalidate, useLeads, useNiches, useSettings, useTemplates } from "@/hooks/useProspector";
import { LeadDialog } from "@/components/LeadDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DEFAULT_WEIGHTS,
  LEAD_STATUS,
  PRIORITIES,
  WEBSITE_STATUS,
  ensureUrl,
  renderTemplate,
  whatsappUrl,
  type Lead,
} from "@/lib/prospector";
import { exportCsv, exportXlsx } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/leads")({
  component: LeadsPage,
});

const ALL = "todos";
const PAGE_SIZE = 20;

function priorityVariant(p: string) {
  if (p === "A+") return "bg-success text-success-foreground";
  if (p === "A") return "bg-primary text-primary-foreground";
  if (p === "B") return "bg-warning text-warning-foreground";
  return "bg-muted text-muted-foreground";
}

function LeadsPage() {
  const { data: leads = [], isLoading, error } = useLeads();
  const { data: niches = [] } = useNiches();
  const { data: templates = [] } = useTemplates();
  const { data: settings } = useSettings();
  const invalidate = useInvalidate();

  const [search, setSearch] = useState("");
  const [niche, setNiche] = useState(ALL);
  const [neighborhood, setNeighborhood] = useState(ALL);
  const [region, setRegion] = useState(ALL);
  const [priority, setPriority] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [siteStatus, setSiteStatus] = useState(ALL);
  const [minScore, setMinScore] = useState("");
  const [minReviews, setMinReviews] = useState("");
  const [hasWhats, setHasWhats] = useState(false);
  const [hasInsta, setHasInsta] = useState(false);
  const [hasLinked, setHasLinked] = useState(false);
  const [sortKey, setSortKey] = useState<keyof Lead>("score");
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const nicheName = (id: string | null) => niches.find((n) => n.id === id)?.name ?? "—";
  const weights = settings?.score_weights ?? DEFAULT_WEIGHTS;

  const neighborhoods = useMemo(
    () => [...new Set(leads.map((l) => l.neighborhood).filter(Boolean) as string[])].sort(),
    [leads],
  );
  const regions = useMemo(
    () => [...new Set(leads.map((l) => l.region).filter(Boolean) as string[])].sort(),
    [leads],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const out = leads.filter((l) => {
      if (term && !l.company.toLowerCase().includes(term)) return false;
      if (niche !== ALL && l.niche_id !== niche) return false;
      if (neighborhood !== ALL && l.neighborhood !== neighborhood) return false;
      if (region !== ALL && l.region !== region) return false;
      if (priority !== ALL && l.priority !== priority) return false;
      if (status !== ALL && l.status !== status) return false;
      if (siteStatus !== ALL && l.website_status !== siteStatus) return false;
      if (minScore && l.score < Number(minScore)) return false;
      if (minReviews && (l.reviews_count ?? 0) < Number(minReviews)) return false;
      if (hasWhats && !l.whatsapp) return false;
      if (hasInsta && !l.instagram) return false;
      if (hasLinked && !l.linkedin) return false;
      return true;
    });
    return out.sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      if (typeof av === "number" && typeof bv === "number") return sortAsc ? av - bv : bv - av;
      return sortAsc
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  }, [
    leads, search, niche, neighborhood, region, priority, status, siteStatus,
    minScore, minReviews, hasWhats, hasInsta, hasLinked, sortKey, sortAsc,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const selectedLeads = leads.filter((l) => selected.includes(l.id));

  const toggleSort = (key: keyof Lead) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const bulkUpdate = async (patch: Partial<Lead>) => {
    if (!selected.length) return;
    const { error: err } = await supabase.from("leads").update(patch as never).in("id", selected);
    if (err) {
      toast.error(err.message);
      return;
    }
    toast.success(`${selected.length} lead(s) atualizado(s)`);
    setSelected([]);
    invalidate(["leads"]);
  };

  const bulkDelete = async () => {
    const { error: err } = await supabase.from("leads").delete().in("id", selected);
    setConfirmDelete(false);
    if (err) {
      toast.error(err.message);
      return;
    }
    toast.success(`${selected.length} lead(s) excluído(s)`);
    setSelected([]);
    invalidate(["leads"]);
  };

  const openWhats = (lead: Lead) => {
    const tpl =
      lead.message?.trim() ||
      templates.find((t) => t.niche_id === lead.niche_id && t.active)?.content ||
      niches.find((n) => n.id === lead.niche_id)?.default_message ||
      "";
    const url = whatsappUrl(lead.whatsapp || lead.phone, renderTemplate(tpl, lead));
    if (!url) {
      toast.error("Número de WhatsApp inválido ou ausente");
      return;
    }
    window.open(url, "_blank", "noopener");
  };

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-destructive">
          Não foi possível carregar os leads: {(error as Error).message}
        </CardContent>
      </Card>
    );
  }

  const exportRows = selectedLeads.length ? selectedLeads : filtered;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Leads</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} lead(s) no filtro atual · {leads.length} no total
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportCsv(exportRows, niches)}>
            <Download className="size-4" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportXlsx(exportRows, niches)}>
            <FileSpreadsheet className="size-4" /> XLSX
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative sm:col-span-2 lg:col-span-2">
            <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por empresa..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <FilterSelect label="Nicho" value={niche} onChange={setNiche}
            options={niches.map((n) => ({ value: n.id, label: n.name }))} />
          <FilterSelect label="Bairro" value={neighborhood} onChange={setNeighborhood}
            options={neighborhoods.map((n) => ({ value: n, label: n }))} />
          <FilterSelect label="Região" value={region} onChange={setRegion}
            options={regions.map((n) => ({ value: n, label: n }))} />
          <FilterSelect label="Prioridade" value={priority} onChange={setPriority}
            options={PRIORITIES.map((p) => ({ value: p, label: p }))} />
          <FilterSelect label="Status" value={status} onChange={setStatus}
            options={Object.entries(LEAD_STATUS).map(([v, l]) => ({ value: v, label: l }))} />
          <FilterSelect label="Status do site" value={siteStatus} onChange={setSiteStatus}
            options={Object.entries(WEBSITE_STATUS).map(([v, l]) => ({ value: v, label: l }))} />
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="number"
              placeholder="Score mín."
              value={minScore}
              onChange={(e) => setMinScore(e.target.value)}
            />
            <Input
              type="number"
              placeholder="Avaliações mín."
              value={minReviews}
              onChange={(e) => setMinReviews(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm sm:col-span-2 lg:col-span-4">
            <label className="flex items-center gap-2">
              <Checkbox checked={hasWhats} onCheckedChange={(v) => setHasWhats(!!v)} /> Com WhatsApp
            </label>
            <label className="flex items-center gap-2">
              <Checkbox checked={hasInsta} onCheckedChange={(v) => setHasInsta(!!v)} /> Com Instagram
            </label>
            <label className="flex items-center gap-2">
              <Checkbox checked={hasLinked} onCheckedChange={(v) => setHasLinked(!!v)} /> Com LinkedIn
            </label>
          </div>
        </CardContent>
      </Card>

      {selected.length > 0 && (
        <Card className="border-primary/40">
          <CardContent className="flex flex-wrap items-center gap-2 p-4">
            <span className="text-sm font-medium">{selected.length} selecionado(s)</span>
            <Select onValueChange={(v) => bulkUpdate({ niche_id: v })}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Alterar nicho" /></SelectTrigger>
              <SelectContent>
                {niches.map((n) => (
                  <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select onValueChange={(v) => bulkUpdate({ priority: v as Lead["priority"] })}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Alterar prioridade" /></SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select onValueChange={(v) => bulkUpdate({ status: v as Lead["status"] })}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Alterar status" /></SelectTrigger>
              <SelectContent>
                {Object.entries(LEAD_STATUS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="secondary" onClick={() => bulkUpdate({ status: "qualificado" })}>
              Marcar qualificado
            </Button>
            <Button size="sm" variant="outline" onClick={() => exportXlsx(selectedLeads, niches, "leads-selecionados.xlsx")}>
              <Download className="size-4" /> Exportar seleção
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="size-4" /> Excluir
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : pageRows.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Nenhum lead encontrado. Importe uma lista na página “Importar Leads”.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={pageRows.every((l) => selected.includes(l.id))}
                        onCheckedChange={(v) =>
                          setSelected(v ? [...new Set([...selected, ...pageRows.map((l) => l.id)])] : [])
                        }
                      />
                    </TableHead>
                    <SortableHead label="Empresa" onClick={() => toggleSort("company")} />
                    <TableHead>Nicho</TableHead>
                    <TableHead>Bairro</TableHead>
                    <SortableHead label="Aval." onClick={() => toggleSort("reviews_count")} />
                    <SortableHead label="Nota" onClick={() => toggleSort("rating")} />
                    <TableHead>Site</TableHead>
                    <TableHead>Redes</TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <SortableHead label="Score" onClick={() => toggleSort("score")} />
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map((lead) => (
                    <TableRow key={lead.id} className="cursor-pointer" onClick={() => setEditing(lead)}>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selected.includes(lead.id)}
                          onCheckedChange={(v) =>
                            setSelected(v ? [...selected, lead.id] : selected.filter((id) => id !== lead.id))
                          }
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {lead.company}
                        {lead.is_demo && (
                          <Badge variant="outline" className="ml-2 text-[10px]">DEMONSTRAÇÃO</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{nicheName(lead.niche_id)}</TableCell>
                      <TableCell className="text-muted-foreground">{lead.neighborhood ?? "—"}</TableCell>
                      <TableCell>{lead.reviews_count ?? 0}</TableCell>
                      <TableCell>{lead.rating ?? "—"}</TableCell>
                      <TableCell className="text-xs">
                        {lead.website ? (
                          <a
                            href={ensureUrl(lead.website) ?? "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            <ExternalLink className="size-3" /> site
                          </a>
                        ) : (
                          <span className="text-muted-foreground">
                            {WEBSITE_STATUS[lead.website_status]}
                          </span>
                        )}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1">
                          {lead.instagram && (
                            <a href={ensureUrl(lead.instagram) ?? "#"} target="_blank" rel="noopener noreferrer">
                              <Instagram className="size-4 text-muted-foreground hover:text-primary" />
                            </a>
                          )}
                          {lead.linkedin && (
                            <a href={ensureUrl(lead.linkedin) ?? "#"} target="_blank" rel="noopener noreferrer">
                              <Linkedin className="size-4 text-muted-foreground hover:text-primary" />
                            </a>
                          )}
                          {!lead.instagram && !lead.linkedin && (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="ghost" onClick={() => openWhats(lead)}>
                          <MessageCircle className="size-4" />
                        </Button>
                      </TableCell>
                      <TableCell className="font-semibold">{lead.score}</TableCell>
                      <TableCell>
                        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${priorityVariant(lead.priority)}`}>
                          {lead.priority}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">{LEAD_STATUS[lead.status]}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Página {currentPage} de {totalPages}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>
            Anterior
          </Button>
          <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>
            Próxima
          </Button>
        </div>
      </div>

      <LeadDialog
        lead={editing}
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        niches={niches}
        templates={templates}
        weights={weights}
        onSaved={() => invalidate(["leads"])}
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir leads selecionados?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. {selected.length} registro(s) serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={bulkDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SortableHead({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <TableHead>
      <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={onClick}>
        {label} <ArrowUpDown className="size-3" />
      </button>
    </TableHead>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{label}: todos</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}