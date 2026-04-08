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
    <div className="flex min-h-screen bg-[linear-gradient(180deg,#f7fbff_0%,#f5f8fc_48%,#f8fafc_100%)]">
      <aside
        className={`relative flex shrink-0 flex-col border-r border-slate-200/80 bg-white/88 backdrop-blur-xl transition-all duration-300 ${
          collapsed ? "w-20" : "w-72"
        }`}
      >
        <div className="absolute inset-x-4 top-4 h-28 rounded-[28px] bg-[linear-gradient(135deg,rgba(224,242,254,0.95),rgba(255,255,255,0.82),rgba(239,246,255,0.95))]" />
        <div className="absolute right-6 top-6 h-16 w-16 rounded-full bg-sky-100/80 blur-2xl" />

        <div className="relative px-4 pb-4 pt-4">
          <div className="rounded-[28px] border border-sky-100/80 bg-white/82 px-4 py-4 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.4)]">
            {collapsed ? (
              <div className="flex items-center justify-center py-2">
                <div className="h-3 w-3 rounded-full bg-primary/80" />
              </div>
            ) : (
              <div className="min-w-0 space-y-3">
                <div className="inline-flex rounded-full border border-primary/10 bg-primary/5 px-2.5 py-1 text-[11px] font-semibold tracking-[0.08em] text-primary">
                  智能审查
                </div>
                <div className="space-y-1.5">
                  <p className="truncate text-lg font-semibold tracking-tight text-slate-900">审查中心</p>
                  <p className="text-[13px] leading-5 text-slate-500">招投标文件智能审查平台</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <nav className="relative flex-1 px-4 pb-4">
          <div className="rounded-[28px] border border-slate-200/80 bg-white/78 p-3 shadow-[0_20px_60px_-44px_rgba(15,23,42,0.3)]">
            <div className="mb-2 px-2 pb-2">
              {!collapsed && <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">导航</p>}
            </div>

            <div className="space-y-1.5">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`group flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-all duration-300 ${
                      isActive ? "bg-primary text-primary-foreground shadow-lg" : "text-slate-600 hover:bg-primary/5 hover:text-primary"
                    }`}
                    title={collapsed ? item.label : undefined}
                  >
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition-colors ${
                        isActive
                          ? "bg-primary-foreground/15"
                          : "bg-slate-100 text-slate-500 group-hover:bg-primary/10 group-hover:text-primary"
                      }`}
                    >
                      <item.icon className="h-5 w-5" />
                    </div>
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>

        <div className="relative px-4 pb-4">
          <button
            type="button"
            onClick={() => setCollapsed((current) => !current)}
            className="flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white/85 py-3 text-slate-500 transition-all duration-300 hover:border-primary/20 hover:bg-primary/5 hover:text-primary"
            aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className={isHome ? "min-h-screen px-6 py-6 xl:px-8" : "mx-auto max-w-7xl p-6"}>{children}</div>
      </main>
    </div>
  );
};

export default AppLayout;
