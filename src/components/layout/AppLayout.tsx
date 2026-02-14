import {
  Bell,
  BookOpen,
  Building2,
  FileText,
  GraduationCap,
  LayoutDashboard,
  ListTodo,
  Menu,
  Newspaper,
  Trophy,
  X,
  ChevronDown,
  Shield,
  Siren,
  ChartNoAxesColumn,
} from "lucide-react";
import { useMemo, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { RoleLabels } from "../../domain/models";
import { useAuth } from "../../contexts/useAuth";
import { canAccessAdmin, canAccessReports } from "../../lib/permissions";
import { usePortalData } from "../../hooks/usePortalData";

export interface LayoutOutletContext {
  searchQuery: string;
}

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
}

const baseNavItems: NavItem[] = [
  { to: "/", label: "Дашборд", icon: LayoutDashboard, end: true },
  { to: "/news", label: "Новости", icon: Newspaper },
  { to: "/kb", label: "База знаний", icon: BookOpen },
  { to: "/lms", label: "Обучение (LMS)", icon: GraduationCap },
  { to: "/docs", label: "Документооборот", icon: FileText },
  { to: "/tasks", label: "Задачи", icon: ListTodo },
  { to: "/ops", label: "Оперцентр", icon: Siren },
  { to: "/org", label: "Оргструктура", icon: Building2 },
  { to: "/ratings", label: "Рейтинги", icon: Trophy },
];

const reportsNavItem: NavItem = { to: "/reports", label: "Отчеты", icon: ChartNoAxesColumn };

export function AppLayout() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const { data } = usePortalData(Boolean(user));

  const outletContext = useMemo<LayoutOutletContext>(() => ({ searchQuery }), [searchQuery]);

  if (!user) {
    return null;
  }

  const navItems = [
    ...baseNavItems,
    ...(canAccessReports(user.role) ? [reportsNavItem] : []),
    ...(canAccessAdmin(user.role) ? [{ to: "/admin", label: "Админка", icon: Shield }] : []),
  ];
  const unreadNotifications = data?.notifications?.filter((item) => !item.isRead).length ?? 0;

  return (
    <div className="flex h-screen bg-gray-50">
      {sidebarOpen ? (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform bg-gradient-to-b from-slate-900 to-slate-800 text-white transition-transform lg:relative lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4">
          <button
            className="flex items-center gap-2"
            onClick={() => {
              navigate("/");
              setSidebarOpen(false);
            }}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500 text-sm font-bold">
              МФ
            </div>
            <span className="text-lg font-bold">МФО Портал</span>
          </button>
          <button
            onClick={() => setSidebarOpen(false)}
            className="text-slate-400 hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    isActive
                      ? "bg-indigo-600 text-white"
                      : "text-slate-300 hover:bg-slate-700 hover:text-white"
                  }`
                }
              >
                <Icon className="h-4.5 w-4.5 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 border-t border-slate-700 p-3">
          <div className="relative">
            <button
              onClick={() => setShowUserMenu((prev) => !prev)}
              className="flex w-full items-center gap-2 rounded-lg bg-slate-700/50 px-3 py-2 text-sm transition hover:bg-slate-700"
            >
              <span className="text-lg">{user.avatar}</span>
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-medium">{user.name}</p>
                <p className="text-xs text-slate-400">{RoleLabels[user.role]}</p>
              </div>
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
            </button>

            {showUserMenu ? (
              <div className="absolute bottom-full left-0 right-0 mb-1 overflow-hidden rounded-lg border border-slate-600 bg-slate-800 shadow-lg">
                <button
                  onClick={() => {
                    logout();
                    setShowUserMenu(false);
                  }}
                  className="w-full border-t border-slate-700 px-3 py-2 text-left text-sm text-red-300 transition hover:bg-slate-700"
                >
                  Выйти
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-500 hover:text-gray-700 lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex flex-1 items-center gap-3">
            <div className="relative max-w-md flex-1">
              <input
                type="text"
                placeholder="Поиск..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <button
            onClick={() => navigate("/notifications")}
            className="relative rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <Bell className="h-5 w-5" />
            {unreadNotifications > 0 ? (
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
            ) : null}
          </button>
          <div className="hidden items-center gap-2 border-l border-gray-200 pl-2 sm:flex">
            <span className="text-lg">{user.avatar}</span>
            <div className="text-right">
              <p className="leading-tight text-sm font-medium text-gray-900">{user.name}</p>
              <p className="text-xs text-gray-400">{RoleLabels[user.role]}</p>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 sm:p-6">
          <Outlet context={outletContext} />
        </div>
      </main>
    </div>
  );
}

