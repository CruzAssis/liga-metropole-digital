import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { Home, ClipboardList, UserCircle, LogOut, Shuffle, LayoutDashboard, ListChecks, Users, BadgeCheck, Shield, FileText, Trophy, ExternalLink, UsersRound, Megaphone } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { useIsAdmin } from "@/hooks/use-is-admin";
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
import { useAuth } from "@/hooks/use-auth";

const items = [
  { title: "Início", url: "/minha-conta", icon: Home },
  { title: "Atletas", url: "/atletas", icon: Users },
  { title: "Verificar ID", url: "/verificar", icon: BadgeCheck },
  { title: "Inscrição", url: "/inscricao", icon: ClipboardList },
  { title: "Minha Conta", url: "/minha-conta", icon: UserCircle },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();

  const adminItems = [
    { title: "Dashboard", url: "/admin/dashboard", icon: LayoutDashboard },
    { title: "Triagem", url: "/admin/triagem", icon: ListChecks },
    { title: "Times", url: "/admin/times", icon: UsersRound },
    { title: "Ligas", url: "/admin/ligas", icon: Trophy },
    { title: "Sorteio", url: "/admin/sorteio", icon: Shuffle },
    { title: "Súmulas", url: "/admin/sumulas", icon: FileText },
    { title: "Manifesto", url: "/admin/manifesto", icon: Megaphone },
    { title: "Usuários", url: "/admin/usuarios", icon: Shield },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  const isActive = (url: string) => pathname === url;

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-3">
          {collapsed ? (
            <BrandLogo className="h-8 w-8" />
          ) : (
            <BrandLogo className="h-9 w-auto" />
          )}
        </div>
      </SidebarHeader>
      <SidebarContent className="gap-1">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
            Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.url + item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.title}
                      className="data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:font-medium hover:bg-sidebar-accent/60 transition-colors"
                    >
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={handleSignOut}
                  tooltip="Sair"
                  className="hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sair</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary/80">
              Admin
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => {
                  const active = isActive(item.url) && item.title !== "Times";
                  return (
                    <SidebarMenuItem key={item.url + item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.title}
                        className="data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:font-medium hover:bg-sidebar-accent/60 transition-colors"
                      >
                        <Link to={item.url}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Ver site">
                    <a href="/" target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                      <span>Ver site</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
