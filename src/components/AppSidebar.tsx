import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Upload,
  Tags,
  MessageSquareText,
  CalendarClock,
  Settings as SettingsIcon,
  Radar,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Pesquisa RX", url: "/pesquisa-rx", icon: Radar },
  { title: "Leads", url: "/leads", icon: Users },
  { title: "Importar Leads", url: "/importar", icon: Upload },
  { title: "Nichos", url: "/nichos", icon: Tags },
  { title: "Mensagens", url: "/mensagens", icon: MessageSquareText },
  { title: "Follow-ups", url: "/followups", icon: CalendarClock },
  { title: "Configurações", url: "/configuracoes", icon: SettingsIcon },
] as const;

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
        <div className="flex items-center gap-2">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Radar className="size-5" />
          </span>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate font-display text-sm font-semibold text-sidebar-foreground">
                Prospector
              </p>
              <p className="truncate text-[11px] text-sidebar-foreground/60">7TEKNOLOGIA</p>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={pathname === item.url} tooltip={item.title}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}