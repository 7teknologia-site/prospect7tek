import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useLeads, useNiches } from "@/hooks/useProspector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Lead } from "@/lib/prospector";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function Metric({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <Card className="gap-1 py-4">
      <CardContent className="px-4">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className={`font-display text-2xl font-bold ${accent ?? ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function groupCount(leads: Lead[], key: (l: Lead) => string) {
  const map = new Map<string, number>();
  leads.forEach((l) => {
    const k = key(l) || "—";
    map.set(k, (map.get(k) ?? 0) + 1);
  });
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
}

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function DashboardPage() {
  const { data: leads = [], isLoading } = useLeads();
  const { data: niches = [] } = useNiches();

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  const count = (fn: (l: Lead) => boolean) => leads.filter(fn).length;
  const nicheName = (id: string | null) => niches.find((n) => n.id === id)?.name ?? "Sem nicho";

  const metrics = [
    { label: "Total de leads", value: leads.length },
    { label: "Leads novos", value: count((l) => l.status === "novo") },
    { label: "Qualificados", value: count((l) => l.status === "qualificado") },
    { label: "Sem site", value: count((l) => l.website_status === "sem_site_confirmado") },
    { label: "Com WhatsApp", value: count((l) => !!l.whatsapp) },
    { label: "Com Instagram", value: count((l) => !!l.instagram) },
    { label: "Com LinkedIn", value: count((l) => !!l.linkedin) },
    { label: "Leads A+", value: count((l) => l.priority === "A+") },
    { label: "Leads A", value: count((l) => l.priority === "A") },
    { label: "Leads B", value: count((l) => l.priority === "B") },
    { label: "Contatados", value: count((l) => !!l.contacted_at || l.status === "contatado") },
    { label: "Respostas", value: count((l) => l.status === "respondeu") },
    { label: "Interessados", value: count((l) => l.status === "interessado") },
    { label: "Propostas", value: count((l) => l.status === "proposta_enviada") },
    { label: "Clientes", value: count((l) => l.status === "cliente") },
  ];

  const byNiche = groupCount(leads, (l) => nicheName(l.niche_id));
  const byNeighborhood = groupCount(leads, (l) => l.neighborhood ?? "");
  const byPriority = ["A+", "A", "B", "C"].map((p) => ({
    name: p,
    value: count((l) => l.priority === p),
  }));

  const contactSeries = (() => {
    const map = new Map<string, number>();
    leads
      .filter((l) => l.contacted_at)
      .forEach((l) => {
        const d = new Date(l.contacted_at as string).toLocaleDateString("pt-BR");
        map.set(d, (map.get(d) ?? 0) + 1);
      });
    return [...map.entries()].map(([name, value]) => ({ name, value })).slice(-14);
  })();

  const funnel = [
    { name: "Total", value: leads.length },
    { name: "Contatados", value: count((l) => !!l.contacted_at || l.status === "contatado") },
    { name: "Respostas", value: count((l) => l.status === "respondeu") },
    { name: "Interessados", value: count((l) => l.status === "interessado") },
    { name: "Propostas", value: count((l) => l.status === "proposta_enviada") },
    { name: "Clientes", value: count((l) => l.status === "cliente") },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Visão geral da sua base de prospecção local.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {metrics.map((m) => (
          <Metric key={m.label} label={m.label} value={m.value} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Leads por nicho">
          <BarChart data={byNiche}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
            <XAxis dataKey="name" fontSize={11} interval={0} angle={-15} textAnchor="end" height={60} />
            <YAxis fontSize={11} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="value" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Leads por bairro">
          <BarChart data={byNeighborhood}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
            <XAxis dataKey="name" fontSize={11} interval={0} angle={-15} textAnchor="end" height={60} />
            <YAxis fontSize={11} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="value" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Leads por prioridade">
          <PieChart>
            <Tooltip />
            <Pie data={byPriority} dataKey="value" nameKey="name" outerRadius={90} label>
              {byPriority.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ChartCard>

        <ChartCard title="Evolução dos contatos">
          {contactSeries.length ? (
            <LineChart data={contactSeries}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
              <XAxis dataKey="name" fontSize={11} />
              <YAxis fontSize={11} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="var(--chart-4)" strokeWidth={2} />
            </LineChart>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-display text-base">Conversão da prospecção</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnel} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.2} />
                <XAxis type="number" fontSize={11} allowDecimals={false} />
                <YAxis type="category" dataKey="name" fontSize={11} width={90} />
                <Tooltip />
                <Bar dataKey="value" fill="var(--chart-3)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactElement }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      Nenhum contato registrado ainda.
    </div>
  );
}