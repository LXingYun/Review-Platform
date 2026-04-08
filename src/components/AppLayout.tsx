import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  FileSearch,
  FolderKanban,
  LayoutDashboard,
} from "lucide-react";

const navItems = [
  { path: "/", label: "仪表盘", icon: LayoutDashboard },
  { path: "/projects", label: "项目管理", icon: FolderKanban },
  { path: "/upload", label: "文件审查", icon: FileSearch },
  { path: "/regulations", label: "法规管理", icon: BookOpen },
];

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const isHome = location.pathname === "/";

  return (
    <div className="flex min-h-screen bg-transparent">
      <aside
        className={`relative hidden shrink-0 border-r border-stone-300/70 bg-[linear-gradient(180deg,rgba(247,241,232,0.92),rgba(244,238,228,0.82))] md:flex md:flex-col ${
          collapsed ? "md:w-24" : "md:w-80"
        } transition-all duration-300`}
      >
        <div className="absolute inset-x-6 top-6 h-40 rounded-[32px] bg-[radial-gradient(circle_at_top,rgba(214,185,140,0.18),transparent_72%)]" />

        <div className="relative px-5 pb-5 pt-6">
          <div className="surface-paper rounded-[30px] px-5 py-5">
            {collapsed ? (
              <div className="flex items-center justify-center py-3">
                <div className="h-10 w-10 rounded-full bg-primary text-center text-sm leading-10 text-primary-foreground">
                  审
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <span className="eyebrow">Review Platform</span>
                <div className="space-y-2">
                  <p className="font-display text-[28px] leading-none text-stone-900">审查中心</p>
                  <p className="max-w-[18rem] text-sm leading-6 text-stone-600">
                    为招标、投标与法规审查提供统一的资料入口、任务编排和复核工作台。
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <nav className="relative flex-1 px-5 pb-5">
          <div className="surface-panel rounded-[30px] p-3">
            {!collapsed && <p className="px-3 pb-3 pt-1 text-[11px] uppercase tracking-[0.22em] text-stone-500">Navigation</p>}
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
                        ? "bg-primary text-primary-foreground shadow-[0_14px_28px_-20px_rgba(24,24,27,0.75)]"
                        : "text-stone-600 hover:bg-white/70 hover:text-stone-900"
                    }`}
                  >
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[18px] transition-colors ${
                        isActive
                          ? "bg-white/10 text-primary-foreground"
                          : "bg-white/70 text-stone-500 group-hover:bg-stone-900/5 group-hover:text-stone-900"
                      }`}
                    >
                      <item.icon className="h-5 w-5" />
                    </div>
                    {!collapsed && (
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{item.label}</p>
                        <p className={`truncate text-xs ${isActive ? "text-primary-foreground/70" : "text-stone-400"}`}>
                          {item.path === "/" ? "品牌入口与总览" : item.path === "/projects" ? "项目、任务与状态" : item.path === "/upload" ? "发起新一轮审查" : "法规与规则底座"}
                        </p>
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>

        <div className="relative px-5 pb-6">
          <button
            type="button"
            onClick={() => setCollapsed((current) => !current)}
            className="flex w-full items-center justify-center rounded-[20px] border border-stone-300/80 bg-white/70 py-3 text-stone-500 transition-colors hover:border-stone-400 hover:bg-white hover:text-stone-900"
            aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="md:hidden">
          <div className="border-b border-stone-300/70 bg-[linear-gradient(180deg,rgba(247,241,232,0.92),rgba(244,238,228,0.82))] px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-stone-500">Review Platform</p>
                <p className="mt-2 font-display text-2xl text-stone-950">审查中心</p>
              </div>
              <div className="rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground">AI 审查</div>
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
                        : "border-stone-300 bg-white/70 text-stone-700"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
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
