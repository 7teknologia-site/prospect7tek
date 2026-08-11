import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useInvalidate, useNiches, useTemplates } from "@/hooks/useProspector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/mensagens")({ component: MessagesPage });

function MessagesPage() {
  const { data: templates = [], isLoading } = useTemplates();
  const { data: niches = [] } = useNiches();
  const invalidate = useInvalidate();
  const [title, setTitle] = useState("");
  const [nicheId, setNicheId] = useState("none");
  const [content, setContent] = useState("");

  const create = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user || !title.trim() || !content.trim()) return;
    const { error } = await supabase.from("message_templates").insert({
      user_id: u.user.id,
      niche_id: nicheId === "none" ? null : nicheId,
      title,
      content,
    } as never);
    if (error) {
      toast.error(error.message);
      return;
    }
    setTitle("");
    setContent("");
    toast.success("Modelo criado");
    invalidate(["templates"]);
  };

  const update = async (id: string, patch: Record<string, unknown>) => {
    const { error } = await supabase.from("message_templates").update(patch as never).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Modelo atualizado");
    invalidate(["templates"]);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Mensagens</h1>
        <p className="text-sm text-muted-foreground">
          Variáveis: {"{{empresa}}"} {"{{segmento}}"} {"{{bairro}}"} {"{{cidade}}"}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">Novo modelo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Título</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nicho</Label>
              <Select value={nicheId} onValueChange={setNicheId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Geral</SelectItem>
                  {niches.map((n) => (
                    <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Textarea rows={5} value={content} onChange={(e) => setContent(e.target.value)} />
          <Button onClick={create} disabled={!title.trim() || !content.trim()}>
            <Plus className="size-4" /> Criar modelo
          </Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {templates.map((t) => (
            <Card key={t.id}>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="font-display text-base">{t.title}</CardTitle>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  Ativo
                  <Switch checked={t.active} onCheckedChange={(v) => update(t.id, { active: v })} />
                </div>
              </CardHeader>
              <CardContent>
                <Textarea
                  rows={7}
                  defaultValue={t.content}
                  onBlur={(e) => {
                    if (e.target.value !== t.content) update(t.id, { content: e.target.value });
                  }}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}