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
  Palette,
} from "lucide-react";
import { appThemes, type AppTheme } from "@/lib/app-themes";

const navItems = [
  { path: "/", label: "仪表盘", helper: "品牌入口与总览", icon: LayoutDashboard },
  { path: "/projects", label: "项目管理", helper: "项目、任务与状态", icon: FolderKanban },
  { path: "/upload", label: "文件审查", helper: "发起新一轮审查", icon: FileSearch },
  { path: "/regulations", label: "法规管理", helper: "法规与规则底座", icon: BookOpen },
];

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const isHome = location.pathname === "/";
  const currentTheme = (theme as AppTheme) || "editorial";

  const activeTheme = useMemo(
    () => appThemes.find((item) => item.value === currentTheme) ?? appThemes[0],
    [currentTheme],
  );

  const renderThemeSwitcher = (compact = false) => (
    <div className={`theme-switcher rounded-[22px] p-1 ${compact ? "w-full" : ""}`}>
      <div className={`flex ${compact ? "w-full flex-col gap-1" : "flex-wrap gap-1"}`}>
        {appThemes.map((themeOption) => (
          <button
            key={themeOption.value}
            type="button"
            data-active={String(currentTheme === themeOption.value)}
            onClick={() => setTheme(themeOption.value)}
            className={`theme-switcher-button ${compact ? "justify-between" : ""}`}
            title={themeOption.description}
          >
            <span className="flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-current/15 bg-white/10 text-[10px] font-semibold">
                {themeOption.shortLabel}
              </span>
              <span>{themeOption.label}</span>
            </span>
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
        } transition-all duration-300`}
      >
        <div className="sidebar-glow absolute inset-x-6 top-6 h-40 rounded-[32px]" />

        <div className="relative px-5 pb-5 pt-6">
          <div className="surface-paper rounded-[30px] px-5 py-5">
            {collapsed ? (
              <div className="flex items-center justify-center py-3">
                <div className="h-10 w-10 rounded-full bg-primary text-center text-sm leading-10 text-primary-foreground">审</div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <span className="eyebrow">Review Platform</span>
                  <div className="shell-tag rounded-full px-3 py-1 text-[11px] font-medium">AI 审查</div>
                </div>
                <div className="space-y-2">
                  <p className="font-display text-[28px] leading-none text-foreground">审查中心</p>
                  <p className="max-w-[18rem] text-sm leading-6 text-muted-foreground">
                    为招标、投标与法规审查提供统一的资料入口、任务编排和复核工作台。
                  </p>
                </div>
                <div className="rounded-[20px] border border-border/80 bg-card/65 px-4 py-3">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    <Palette className="h-3.5 w-3.5" />
                    主题
                  </div>
                  <p className="mt-2 text-sm font-medium text-foreground">{activeTheme.label}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{activeTheme.description}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <nav className="relative flex-1 px-5 pb-5">
          <div className="surface-panel rounded-[30px] p-3">
            {!collapsed && <p className="px-3 pb-3 pt-1 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Navigation</p>}
            <div className="space-y-1.5">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    title={collapsed ? item.label : undefined}
                    className={`group flex items-center gap-3 rounded-[22px] px-3 py-3 transition-all duration-200 ${
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
                        <p className={`truncate text-xs ${isActive ? "text-primary-foreground/70" : "text-muted-foreground/80"}`}>{item.helper}</p>
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>

            {!collapsed && (
              <div className="mt-4 border-t border-border/80 pt-4">
                <p className="px-3 pb-3 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Themes</p>
                {renderThemeSwitcher()}
              </div>
            )}
          </div>
        </nav>

        <div className="relative space-y-3 px-5 pb-6">
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
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Review Platform</p>
                <p className="mt-2 font-display text-2xl text-foreground">审查中心</p>
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
                      isActive ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card/72 text-foreground"
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

        <div className={isHome ? "min-h-screen px-5 py-5 md:px-8 md:py-7" : "mx-auto max-w-[1120px] px-5 py-6 md:px-8 md:py-8"}>
          {children}
        </div>
      </main>
    </div>
  );
};

export default AppLayout;
