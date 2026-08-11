import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, ExternalLink, Instagram, Linkedin, MessageCircle, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LEAD_STATUS,
  PRIORITIES,
  WEBSITE_STATUS,
  buildOpportunityReason,
  computeScore,
  ensureUrl,
  priorityFromScore,
  renderTemplate,
  whatsappUrl,
  type Lead,
  type MessageTemplate,
  type Niche,
  type ScoreWeights,
} from "@/lib/prospector";

type Props = {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  niches: Niche[];
  templates: MessageTemplate[];
  weights: ScoreWeights;
  onSaved: () => void;
};

export function LeadDialog({ lead, open, onOpenChange, niches, templates, weights, onSaved }: Props) {
  const [form, setForm] = useState<Lead | null>(lead);
  const [saving, setSaving] = useState(false);
  const [interaction, setInteraction] = useState({ channel: "whatsapp", response: "", result: "", notes: "" });

  useEffect(() => setForm(lead), [lead]);
  if (!form) return null;

  const set = <K extends keyof Lead>(key: K, value: Lead[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  const nicheTemplate =
    templates.find((t) => t.niche_id === form.niche_id && t.active) ??
    niches.find((n) => n.id === form.niche_id)?.default_message;
  const templateContent =
    typeof nicheTemplate === "string" ? nicheTemplate : (nicheTemplate?.content ?? "");
  const message = form.message?.trim()
    ? renderTemplate(form.message, form)
    : renderTemplate(templateContent, form);

  const recalc = () => {
    const score = computeScore(form, weights);
    setForm({
      ...form,
      score,
      priority: priorityFromScore(score),
      opportunity_reason: buildOpportunityReason(form),
    });
    toast.success("Score e prioridade recalculados");
  };

  const save = async () => {
    setSaving(true);
    const { id, user_id: _u, created_at: _c, updated_at: _up, ...rest } = form;
    const { error } = await supabase.from("leads").update(rest as never).eq("id", id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Lead atualizado");
    onSaved();
    onOpenChange(false);
  };

  const openWhatsapp = () => {
    const url = whatsappUrl(form.whatsapp || form.phone, message);
    if (!url) {
      toast.error("Número de WhatsApp inválido ou ausente");
      return;
    }
    window.open(url, "_blank", "noopener");
  };

  const copyMessage = async () => {
    await navigator.clipboard.writeText(message);
    toast.success("Mensagem copiada");
  };

  const registerInteraction = async () => {
    const { error } = await supabase.from("lead_interactions").insert({
      lead_id: form.id,
      user_id: form.user_id,
      channel: interaction.channel,
      response: interaction.response || null,
      result: interaction.result || null,
      notes: interaction.notes || null,
      next_followup_at: form.followup_at,
    } as never);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase
      .from("leads")
      .update({ contacted_at: form.contacted_at ?? new Date().toISOString(), status: "contatado" } as never)
      .eq("id", form.id);
    toast.success("Contato registrado");
    setInteraction({ channel: "whatsapp", response: "", result: "", notes: "" });
    onSaved();
  };

  const field = (label: string, key: keyof Lead, type: "text" | "number" = "text") => (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        type={type}
        value={(form[key] as string | number | null) ?? ""}
        onChange={(e) =>
          set(
            key,
            (type === "number"
              ? e.target.value === ""
                ? null
                : Number(e.target.value)
              : e.target.value) as Lead[typeof key],
          )
        }
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">{form.company}</DialogTitle>
          <DialogDescription>
            Score {form.score} · Prioridade {form.priority} · {LEAD_STATUS[form.status]}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="dados">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="dados">Dados</TabsTrigger>
            <TabsTrigger value="mensagem">Mensagem</TabsTrigger>
            <TabsTrigger value="contato">Contato</TabsTrigger>
          </TabsList>

          <TabsContent value="dados" className="space-y-4 pt-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {field("Empresa", "company")}
              <div className="space-y-1.5">
                <Label className="text-xs">Nicho</Label>
                <Select
                  value={form.niche_id ?? "none"}
                  onValueChange={(v) => set("niche_id", v === "none" ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem nicho</SelectItem>
                    {niches.map((n) => (
                      <SelectItem key={n.id} value={n.id}>
                        {n.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {field("Segmento", "segment")}
              {field("Subsegmento", "subsegment")}
              {field("Região", "region")}
              {field("Bairro", "neighborhood")}
              {field("Endereço", "address")}
              {field("Cidade", "city")}
              {field("Estado", "state")}
              {field("CEP", "zip")}
              {field("Telefone", "phone")}
              {field("WhatsApp", "whatsapp")}
              {field("Google Maps", "google_maps_url")}
              {field("Avaliações Google", "reviews_count", "number")}
              {field("Nota Google", "rating", "number")}
              {field("Site", "website")}
              <div className="space-y-1.5">
                <Label className="text-xs">Status do site</Label>
                <Select
                  value={form.website_status}
                  onValueChange={(v) => set("website_status", v as Lead["website_status"])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(WEBSITE_STATUS).map(([k, label]) => (
                      <SelectItem key={k} value={k}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {field("Instagram", "instagram")}
              {field("LinkedIn", "linkedin")}
              {field("Facebook", "facebook")}
              <div className="space-y-1.5">
                <Label className="text-xs">Prioridade</Label>
                <Select value={form.priority} onValueChange={(v) => set("priority", v as Lead["priority"])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Status comercial</Label>
                <Select value={form.status} onValueChange={(v) => set("status", v as Lead["status"])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(LEAD_STATUS).map(([k, label]) => (
                      <SelectItem key={k} value={k}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {field("Score", "score", "number")}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Motivo da oportunidade</Label>
              <Textarea
                rows={2}
                value={form.opportunity_reason ?? ""}
                onChange={(e) => set("opportunity_reason", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Observações</Label>
              <Textarea rows={2} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={recalc}>
                <Wand2 className="size-4" /> Recalcular score
              </Button>
              {form.instagram && (
                <Button variant="outline" size="sm" asChild>
                  <a href={ensureUrl(form.instagram) ?? "#"} target="_blank" rel="noopener noreferrer">
                    <Instagram className="size-4" /> Abrir Instagram
                  </a>
                </Button>
              )}
              {form.linkedin && (
                <Button variant="outline" size="sm" asChild>
                  <a href={ensureUrl(form.linkedin) ?? "#"} target="_blank" rel="noopener noreferrer">
                    <Linkedin className="size-4" /> Abrir LinkedIn
                  </a>
                </Button>
              )}
              {form.website && (
                <Button variant="outline" size="sm" asChild>
                  <a href={ensureUrl(form.website) ?? "#"} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="size-4" /> Abrir site
                  </a>
                </Button>
              )}
            </div>
          </TabsContent>

          <TabsContent value="mensagem" className="space-y-4 pt-4">
            <p className="text-xs text-muted-foreground">
              Variáveis disponíveis: {"{{empresa}}"} {"{{segmento}}"} {"{{bairro}}"} {"{{cidade}}"}
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">Mensagem personalizada (opcional)</Label>
              <Textarea
                rows={6}
                placeholder="Deixe vazio para usar o modelo do nicho"
                value={form.message ?? ""}
                onChange={(e) => set("message", e.target.value)}
              />
            </div>
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Pré-visualização</p>
              <p className="whitespace-pre-wrap text-sm">{message || "Nenhum modelo definido."}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={openWhatsapp}>
                <MessageCircle className="size-4" /> Abrir WhatsApp
              </Button>
              <Button variant="outline" onClick={copyMessage}>
                <Copy className="size-4" /> Copiar mensagem
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              O sistema não envia mensagens automaticamente — o envio é sempre feito por você.
            </p>
          </TabsContent>

          <TabsContent value="contato" className="space-y-4 pt-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Data do contato</Label>
                <Input
                  type="date"
                  value={form.contacted_at ? form.contacted_at.slice(0, 10) : ""}
                  onChange={(e) =>
                    set("contacted_at", e.target.value ? new Date(e.target.value).toISOString() : null)
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Data do follow-up</Label>
                <Input
                  type="date"
                  value={form.followup_at ? form.followup_at.slice(0, 10) : ""}
                  onChange={(e) =>
                    set("followup_at", e.target.value ? new Date(e.target.value).toISOString() : null)
                  }
                />
              </div>
              {field("Resultado", "result")}
              <div className="space-y-1.5">
                <Label className="text-xs">Canal do registro</Label>
                <Select
                  value={interaction.channel}
                  onValueChange={(v) => setInteraction((i) => ({ ...i, channel: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["whatsapp", "telefone", "email", "instagram", "linkedin", "presencial"].map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Resposta recebida</Label>
              <Textarea
                rows={2}
                value={interaction.response}
                onChange={(e) => setInteraction((i) => ({ ...i, response: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Observações do contato</Label>
              <Textarea
                rows={2}
                value={interaction.notes}
                onChange={(e) => setInteraction((i) => ({ ...i, notes: e.target.value }))}
              />
            </div>
            <Button variant="secondary" onClick={registerInteraction}>
              Registrar contato
            </Button>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Salvando..." : "Salvar alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}