import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useInvalidate, useNiches } from "@/hooks/useProspector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/nichos")({ component: NichesPage });

function NichesPage() {
  const { data: niches = [], isLoading } = useNiches();
  const invalidate = useInvalidate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const create = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user || !name.trim()) return;
    const { error } = await supabase
      .from("niches")
      .insert({ user_id: u.user.id, name: name.trim(), description } as never);
    if (error) {
      toast.error(error.message);
      return;
    }
    setName("");
    setDescription("");
    toast.success("Nicho criado");
    invalidate(["niches"]);
  };

  const update = async (id: string, patch: Record<string, unknown>) => {
    const { error } = await supabase.from("niches").update(patch as never).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Nicho atualizado");
    invalidate(["niches"]);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Nichos</h1>
        <p className="text-sm text-muted-foreground">Organize seus leads por segmento de atuação.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">Novo nicho</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label className="text-xs">Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Descrição</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <Button onClick={create} disabled={!name.trim()}>
            <Plus className="size-4" /> Criar
          </Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {niches.map((n) => (
            <Card key={n.id}>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="font-display text-base">{n.name}</CardTitle>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  Ativo
                  <Switch
                    checked={n.active}
                    onCheckedChange={(v) => update(n.id, { active: v })}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">{n.description ?? "Sem descrição"}</p>
                <div className="space-y-1.5">
                  <Label className="text-xs">Mensagem padrão</Label>
                  <Textarea
                    rows={6}
                    defaultValue={n.default_message ?? ""}
                    onBlur={(e) => {
                      if (e.target.value !== (n.default_message ?? ""))
                        update(n.id, { default_message: e.target.value });
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}