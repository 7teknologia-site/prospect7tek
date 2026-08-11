import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useInvalidate, useLeads, useNiches, useSettings, useTemplates } from "@/hooks/useProspector";
import { LeadDialog } from "@/components/LeadDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DEFAULT_WEIGHTS, LEAD_STATUS, formatDate, type Lead } from "@/lib/prospector";

export const Route = createFileRoute("/_authenticated/followups")({ component: FollowupsPage });

const FILTERS = {
  hoje: "Follow-up hoje",
  atrasado: "Follow-up atrasado",
  sem_resposta: "Sem resposta",
  interessados: "Interessados",
  propostas: "Propostas enviadas",
  todos: "Todos",
} as const;
type FilterKey = keyof typeof FILTERS;

function FollowupsPage() {
  const { data: leads = [], isLoading } = useLeads();
  const { data: niches = [] } = useNiches();
  const { data: templates = [] } = useTemplates();
  const { data: settings } = useSettings();
  const invalidate = useInvalidate();
  const [filter, setFilter] = useState<FilterKey>("todos");
  const [editing, setEditing] = useState<Lead | null>(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rows = leads.filter((l) => {
    const f = l.followup_at ? new Date(l.followup_at) : null;
    if (f) f.setHours(0, 0, 0, 0);
    switch (filter) {
      case "hoje":
        return f?.getTime() === today.getTime();
      case "atrasado":
        return !!f && f.getTime() < today.getTime() && l.status !== "cliente";
      case "sem_resposta":
        return l.status === "sem_resposta" || (!!l.contacted_at && l.status === "contatado");
      case "interessados":
        return l.status === "interessado";
      case "propostas":
        return l.status === "proposta_enviada";
      default:
        return !!l.contacted_at || !!l.followup_at;
    }
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold">Follow-ups</h1>
        <p className="text-sm text-muted-foreground">Acompanhe contatos, respostas e retornos.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(FILTERS) as FilterKey[]).map((k) => (
          <Button
            key={k}
            size="sm"
            variant={filter === k ? "default" : "outline"}
            onClick={() => setFilter(k)}
          >
            {FILTERS[k]}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Carregando...</p>
          ) : rows.length === 0 ? (
            <p className="p-10 text-center text-sm text-muted-foreground">
              Nenhum lead nesse filtro.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Follow-up</TableHead>
                    <TableHead>Resultado</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{l.company}</TableCell>
                      <TableCell className="text-xs">{LEAD_STATUS[l.status]}</TableCell>
                      <TableCell className="text-xs">{formatDate(l.contacted_at)}</TableCell>
                      <TableCell className="text-xs">{formatDate(l.followup_at)}</TableCell>
                      <TableCell className="text-xs">{l.result ?? "—"}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(l)}>
                          Registrar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <LeadDialog
        lead={editing}
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        niches={niches}
        templates={templates}
        weights={settings?.score_weights ?? DEFAULT_WEIGHTS}
        onSaved={() => invalidate(["leads"])}
      />
    </div>
  );
}