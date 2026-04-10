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
} from "lucide-react";
import { appThemes, type AppTheme } from "@/lib/app-themes";

const navItems = [
  { path: "/", label: "仪表盘", helper: "总览当前审查工作", icon: LayoutDashboard },
  { path: "/projects", label: "项目管理", helper: "查看和维护审查项目", icon: FolderKanban },
  { path: "/upload", label: "文件审查", helper: "上传文件并发起审查", icon: FileSearch },
  { path: "/regulations", label: "法规管理", helper: "维护法规与规则条目", icon: BookOpen },
];

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const isHome = location.pathname === "/";
  const isProjectsPage = location.pathname === "/projects";
  const currentTheme = (theme as AppTheme) || "editorial";

  const renderThemeSwitcher = (compact = false) => (
    <div className={`theme-switcher rounded-[22px] ${compact ? "mx-auto p-2" : "w-fit p-1"}`}>
      <div className={`flex ${compact ? "flex-col items-center gap-2" : "items-center gap-1"}`}>
        {appThemes.map((themeOption) => (
          <button
            key={themeOption.value}
            type="button"
            data-active={String(currentTheme === themeOption.value)}
            onClick={() => setTheme(themeOption.value)}
            className={`theme-switcher-button ${compact ? "h-10 w-10 justify-center rounded-full px-0 py-0" : ""}`}
            title={themeOption.description}
            aria-label={`切换到${themeOption.label}`}
          >
            {compact ? (
              <span className="text-[11px] font-semibold">{themeOption.shortLabel}</span>
            ) : (
              <span className="flex items-center gap-1.5">
                <span className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-full border border-current/15 bg-white/10 text-[9px] font-semibold">
                  {themeOption.shortLabel}
                </span>
                <span>{themeOption.label}</span>
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-transparent">
      <aside
        className={`sidebar-shell relative hidden shrink-0 md:flex md:flex-col ${
          collapsed ? "md:w-24" : "md:w-80"
        } md:sticky md:top-0 md:h-screen md:self-start transition-all duration-300`}
      >
        <div className="sidebar-glow absolute inset-x-6 top-6 h-40 rounded-[32px]" />

        <div className={`relative pb-5 pt-6 ${collapsed ? "px-3" : "px-5"}`}>
          <div className={`surface-paper rounded-[30px] ${collapsed ? "px-3 py-4" : "px-5 py-5"}`}>
            {collapsed ? (
              <div className="flex items-center justify-center py-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-border/80 bg-white/85 shadow-sm">
                  <img src="/logo1.png" alt="招投标文件审查中心" className="h-9 w-9 object-contain" />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <span className="eyebrow">招投标文件审查中心</span>
                  <div className="shell-tag rounded-full px-3 py-1 text-[11px] font-medium">AI 审查</div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] border border-border/80 bg-white/90 shadow-sm">
                    <img src="/logo1.png" alt="招投标文件审查中心" className="h-11 w-11 object-contain" />
                  </div>
                  <div className="space-y-2">
                    <p className="font-display text-[28px] leading-none text-foreground">招投标文件审查中心</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <nav className={`relative flex-1 overflow-y-auto pb-5 ${collapsed ? "px-3" : "px-5"}`}>
          <div className={`surface-panel rounded-[30px] ${collapsed ? "px-2 py-3" : "p-3"}`}>
            {!collapsed && (
              <p className="px-3 pb-3 pt-1 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">导航</p>
            )}

            <div className={`space-y-1.5 ${collapsed ? "flex flex-col items-center" : ""}`}>
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    title={collapsed ? item.label : undefined}
                    className={`group flex items-center gap-3 rounded-[22px] transition-all duration-200 ${
                      collapsed ? "h-14 w-14 justify-center px-0 py-0" : "px-3 py-3"
                    } ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-[0_14px_28px_-20px_rgba(24,24,27,0.55)]"
                        : "text-muted-foreground hover:bg-card/70 hover:text-foreground"
                    }`}
                  >
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[18px] transition-colors ${
                        isActive
                          ? "bg-white/10 text-primary-foreground"
                          : "bg-card/70 text-muted-foreground group-hover:bg-primary/10 group-hover:text-foreground"
                      }`}
                    >
                      <item.icon className="h-5 w-5" />
                    </div>

                    {!collapsed && (
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{item.label}</p>
                        <p
                          className={`truncate text-xs ${
                            isActive ? "text-primary-foreground/70" : "text-muted-foreground/80"
                          }`}
                        >
                          {item.helper}
                        </p>
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>

            {!collapsed && (
              <div className="mt-4 border-t border-border/80 pt-4">
                <p className="px-3 pb-3 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">主题切换</p>
                {renderThemeSwitcher()}
              </div>
            )}
          </div>
        </nav>

        <div className={`sticky bottom-0 z-10 mt-auto space-y-3 pb-6 pt-4 ${collapsed ? "px-3" : "px-5"}`} style={{ background: "var(--shell-footer-bg)" }}>
          {collapsed && renderThemeSwitcher(true)}
          <button
            type="button"
            onClick={() => setCollapsed((current) => !current)}
            className="flex w-full items-center justify-center rounded-[20px] border border-border/80 bg-card/70 py-3 text-muted-foreground transition-colors hover:border-border hover:bg-card hover:text-foreground"
            aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="md:hidden">
          <div className="sidebar-shell border-b px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border border-border/80 bg-white/90 shadow-sm">
                  <img src="/logo1.png" alt="招投标文件审查中心" className="h-9 w-9 object-contain" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">招投标文件审查中心</p>
                  <p className="mt-1 font-display text-2xl text-foreground">文件审查中心</p>
                </div>
              </div>
              <div className="shell-tag rounded-full px-3 py-1 text-xs">AI 审查</div>
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

            <div className="mt-4">{renderThemeSwitcher()}</div>
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
