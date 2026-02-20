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
  ChartNoAxesColumn,
  Settings2,
  Search,
  LogOut,
  Home,
  ShoppingCart,
} from "lucide-react";
import { useMemo, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { RoleLabels } from "../../domain/models";
import { useAuth } from "../../contexts/useAuth";
import { canAccessAdmin, canAccessReports, canManageLMS } from "../../lib/permissions";
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
  { to: "/lms", label: "Обучение", icon: GraduationCap },
  { to: "/docs", label: "Документы", icon: FileText },
  { to: "/tasks", label: "Задачи", icon: ListTodo },
  { to: "/shop", label: "Магазин", icon: ShoppingCart },
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
    ...(canManageLMS(user.role) ? [{ to: "/lms-builder", label: "LMS Конструктор", icon: Settings2 }] : []),
    ...(canAccessReports(user.role) ? [reportsNavItem] : []),
    ...(canAccessAdmin(user.role) ? [{ to: "/admin", label: "Админка", icon: Shield }] : []),
  ];
  const unreadNotifications = data?.notifications?.filter((item) => !item.isRead).length ?? 0;

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile overlay */}
      {sidebarOpen ? (
        <div
          className="fixed inset-0 z-30 bg-gray-900/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 transform bg-white border-r border-gray-200 transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-5 border-b border-gray-100">
          <button
            className="flex items-center gap-3"
            onClick={() => {
              navigate("/");
              setSidebarOpen(false);
            }}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-sm font-bold text-white shadow-lg shadow-indigo-200">
              МФ
            </div>
            <div>
              <span className="text-lg font-bold text-gray-900">МФО Портал</span>
              <p className="text-xs text-gray-400">Корпоративная система</p>
            </div>
          </button>
          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-indigo-50 text-indigo-600"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                          isActive ? "bg-indigo-100" : "bg-gray-100 group-hover:bg-gray-200"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <span>{item.label}</span>
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        </nav>

        {/* User section */}
        <div className="border-t border-gray-100 p-4">
          <div className="relative">
            <button
              onClick={() => setShowUserMenu((prev) => !prev)}
              className="flex w-full items-center gap-3 rounded-xl bg-gray-50 px-3 py-3 transition-colors hover:bg-gray-100"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-lg text-white">
                {user.avatar}
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-medium text-gray-900">{user.name}</p>
                <p className="text-xs text-gray-500">{RoleLabels[user.role]}</p>
              </div>
              <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${showUserMenu ? "rotate-180" : ""}`} />
            </button>

            {showUserMenu && (
              <div className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg shadow-gray-200/50">
                <div className="p-2">
                  <button
                    onClick={() => {
                      navigate("/");
                      setShowUserMenu(false);
                      setSidebarOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    <Home className="h-4 w-4" />
                    На главную
                  </button>
                </div>
                <div className="border-t border-gray-100 p-2">
                  <button
                    onClick={() => {
                      logout();
                      setShowUserMenu(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" />
                    Выйти
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-16 shrink-0 items-center gap-4 border-b border-gray-100 bg-white px-4 lg:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Search */}
          <div className="flex flex-1 items-center gap-4">
            <div className="relative max-w-xl flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Поиск по порталу..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    navigate("/search");
                  }
                }}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm transition-colors placeholder:text-gray-400 focus:border-indigo-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Notifications */}
            <button
              onClick={() => navigate("/notifications")}
              className="relative rounded-xl p-2.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            >
              <Bell className="h-5 w-5" />
              {unreadNotifications > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-2 w-2 items-center justify-center rounded-full bg-red-500">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                </span>
              )}
            </button>

            {/* User avatar (desktop) */}
            <div className="hidden items-center gap-3 border-l border-gray-100 pl-4 sm:flex">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-sm text-white">
                {user.avatar}
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user.name}</p>
                <p className="text-xs text-gray-400">{RoleLabels[user.role]}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-auto bg-gray-50 p-4 sm:p-6 lg:p-8">
          <Outlet context={outletContext} />
        </div>
      </main>
    </div>
  );
}
