import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTheme } from "next-themes";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  FileSearch,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Users,
} from "lucide-react";
import { appThemes, type AppTheme } from "@/lib/app-themes";
import { useAuth } from "@/context/AuthProvider";

const baseNavItems = [
  { path: "/", label: "仪表盘", helper: "查看当前审查工作", icon: LayoutDashboard },
  { path: "/projects", label: "项目管理", helper: "维护你的审查项目", icon: FolderKanban },
  { path: "/upload", label: "文件审查", helper: "上传并发起审查任务", icon: FileSearch },
  { path: "/regulations", label: "法规管理", helper: "查看法规库", icon: BookOpen },
];

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const isHome = location.pathname === "/";
  const isProjectsPage = location.pathname === "/projects";
  const currentTheme = (theme as AppTheme) || "editorial";

  const navItems = useMemo(() => {
    const items = [...baseNavItems];
    if (user?.role === "admin") {
      items.push({
        path: "/admin/users",
        label: "用户管理",
        helper: "管理账号与权限",
        icon: Users,
      });
    }
    return items;
  }, [user?.role]);

  return (
    <div className="flex min-h-screen bg-transparent">
      <aside
        className={`sidebar-shell hidden shrink-0 border-r border-border/70 transition-all duration-300 md:flex md:flex-col ${
          collapsed ? "md:w-24" : "md:w-80"
        }`}
      >
        <div className={`border-b border-border/70 ${collapsed ? "px-3 py-4" : "px-5 py-6"}`}>
          <div className={`rounded-2xl bg-card/70 ${collapsed ? "p-3" : "p-4"}`}>
            {collapsed ? (
              <div className="flex items-center justify-center">
                <img src="/logo1.png" alt="logo" className="h-10 w-10 object-contain" />
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-background/75">
                  <img src="/logo1.png" alt="logo" className="h-9 w-9 object-contain" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Review Platform</p>
                  <p className="font-display text-xl text-foreground">审查中心</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <nav className={`flex-1 overflow-y-auto ${collapsed ? "px-2 py-3" : "px-4 py-5"}`}>
          <div className="space-y-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  title={collapsed ? item.label : undefined}
                  className={`group flex items-center gap-3 rounded-2xl transition-all ${
                    collapsed ? "h-14 w-14 justify-center px-0 py-0 mx-auto" : "px-3 py-3"
                  } ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-card/80 hover:text-foreground"
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                      isActive ? "bg-white/10" : "bg-card/70 group-hover:bg-primary/10"
                    }`}
                  >
                    <item.icon className="h-5 w-5" />
                  </div>

                  {!collapsed ? (
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.label}</p>
                      <p
                        className={`truncate text-xs ${
                          isActive ? "text-primary-foreground/75" : "text-muted-foreground/85"
                        }`}
                      >
                        {item.helper}
                      </p>
                    </div>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className={`mt-auto space-y-3 border-t border-border/70 ${collapsed ? "p-3" : "p-4"}`}>
          {!collapsed ? (
            <div className="flex flex-wrap gap-2">
              {appThemes.map((themeOption) => (
                <button
                  key={themeOption.value}
                  type="button"
                  onClick={() => setTheme(themeOption.value)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    currentTheme === themeOption.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {themeOption.label}
                </button>
              ))}
            </div>
          ) : null}

          {user ? (
            <div className={`rounded-2xl border border-border/70 bg-card/70 ${collapsed ? "p-2" : "p-3"}`}>
              {!collapsed ? (
                <>
                  <p className="truncate text-sm font-medium text-foreground">{user.username}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">{user.role}</p>
                </>
              ) : null}
              <button
                type="button"
                onClick={() => void logout()}
                className={`mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-border/70 bg-background/75 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground ${
                  collapsed ? "mt-0" : ""
                }`}
              >
                <LogOut className="h-3.5 w-3.5" />
                {!collapsed ? "退出登录" : null}
              </button>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => setCollapsed((current) => !current)}
            className="flex w-full items-center justify-center rounded-2xl border border-border/80 bg-card/70 py-3 text-muted-foreground transition-colors hover:border-border hover:bg-card hover:text-foreground"
            aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="md:hidden">
          <div className="sidebar-shell border-b border-border/70 px-5 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-background/80">
                  <img src="/logo1.png" alt="logo" className="h-8 w-8 object-contain" />
                </div>
                <p className="font-display text-xl text-foreground">审查中心</p>
              </div>
              {user ? (
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
                >
                  退出
                </button>
              ) : null}
            </div>

            <div className="mt-4 flex gap-2 overflow-auto pb-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`whitespace-nowrap rounded-full border px-3 py-2 text-sm transition-colors ${
                      isActive
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card/72 text-foreground"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        <div
          className={
            isHome
              ? "min-h-screen px-5 py-5 md:px-8 md:py-7"
              : isProjectsPage
                ? "mx-auto max-w-[1280px] px-5 py-6 md:px-8 md:py-8"
                : "mx-auto max-w-[1120px] px-5 py-6 md:px-8 md:py-8"
          }
        >
          {children}
        </div>
      </main>
    </div>
  );
};

export default AppLayout;
