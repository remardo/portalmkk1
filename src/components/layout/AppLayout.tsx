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
  PhoneCall,
} from "lucide-react";
import { useMemo, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { RoleLabels } from "../../domain/models";
import { useAuth } from "../../contexts/useAuth";
import { canAccessAdmin, canAccessReports, canManageLMS } from "../../lib/permissions";
import { usePortalData } from "../../hooks/usePortalData";
import { AgentChatWidget } from "../assistant/AgentChatWidget";

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
  { to: "/crm", label: "CRM", icon: PhoneCall },
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
    <div className="flex h-screen bg-transparent p-2 md:p-4 lg:p-6 overflow-hidden">
      <div className="flex w-full overflow-hidden rounded-[2.5rem] bg-white shadow-xl ring-1 ring-zinc-200/50">

        {/* Mobile overlay */}
        {sidebarOpen ? (
          <div
            className="fixed inset-0 z-30 bg-zinc-900/40 backdrop-blur-sm lg:hidden rounded-[2.5rem]"
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}

        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-[260px] transform bg-white border-r border-zinc-100 transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"
            } flex flex-col`}
        >
          {/* Logo */}
          <div className="flex items-center justify-between h-[88px] px-8 border-b border-transparent">
            <button
              className="flex items-center gap-3 w-full"
              onClick={() => {
                navigate("/");
                setSidebarOpen(false);
              }}
            >
              <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-sm font-bold text-white shadow-md shadow-purple-200">
                МФ
              </div>
              <div className="text-left overflow-hidden">
                <span className="text-[17px] font-extrabold text-zinc-900 tracking-tight block">МФО Портал</span>
                <span className="text-[11px] text-zinc-400 block font-medium">Корпоративная сеть</span>
              </div>
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 lg:hidden shrink-0"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar">
            <div className="space-y-1">
              <div className="mb-4 pl-2 flex items-center justify-between opacity-80 mt-2">
                <span className="text-[11px] font-bold tracking-widest text-zinc-400 uppercase">Меню</span>
                <div className="h-4 w-4 rounded bg-zinc-50 flex items-center justify-center">
                  <Home className="h-[10px] w-[10px] text-zinc-400" />
                </div>
              </div>

              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      `group relative flex w-full items-center gap-[18px] rounded-xl px-2 py-3 text-[15px] transition-all duration-300 ${isActive
                        ? "text-zinc-900 font-bold"
                        : "text-zinc-500 font-medium hover:text-zinc-900 hover:translate-x-1"
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon
                          className={`h-[22px] w-[22px] shrink-0 transition-colors ${isActive ? "text-zinc-900" : "text-zinc-400 group-hover:text-zinc-600"}`}
                          strokeWidth={isActive ? 2.5 : 2}
                        />
                        <span className="truncate">{item.label}</span>
                        {isActive && (
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center h-5 w-5 rounded-full bg-zinc-50 ring-1 ring-zinc-200/50">
                            <div className="w-1.5 h-1.5 rounded-full bg-zinc-900" />
                          </div>
                        )}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </nav>

          {/* User section */}
          <div className="p-6">
            <div className="relative">
              <button
                onClick={() => setShowUserMenu((prev) => !prev)}
                className="flex w-full items-center justify-between gap-3 transition-colors hover:opacity-80"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-bold text-zinc-700 shadow-sm border border-zinc-200">
                    {user.avatar}
                  </div>
                  <div className="min-w-0 text-left">
                    <p className="truncate text-[15px] font-bold text-zinc-900">{user.name}</p>
                    <p className="text-[11px] text-zinc-400 font-medium truncate tracking-wide">{RoleLabels[user.role]}</p>
                  </div>
                </div>
                <div className="h-8 w-8 rounded-full bg-zinc-50 flex items-center justify-center shadow-sm">
                  <ChevronDown className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${showUserMenu ? "rotate-180" : ""}`} />
                </div>
              </button>

              {showUserMenu && (
                <div className="absolute bottom-full left-0 right-0 mb-3 overflow-hidden rounded-[1.25rem] border border-zinc-200 bg-white shadow-xl shadow-zinc-200/50">
                  <div className="p-2 space-y-1">
                    <button
                      onClick={() => {
                        navigate("/");
                        setShowUserMenu(false);
                        setSidebarOpen(false);
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[14px] font-semibold text-zinc-700 transition-colors hover:bg-zinc-100"
                    >
                      <Home className="h-4 w-4" />
                      На главную
                    </button>
                    <div className="my-1 border-t border-zinc-100" />
                    <button
                      onClick={() => {
                        logout();
                        setShowUserMenu(false);
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[14px] font-semibold text-rose-600 transition-colors hover:bg-rose-50"
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

        {/* Main content area */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-white lg:border-l lg:border-zinc-100">
          {/* Header */}
          <header className="flex h-[88px] shrink-0 items-center gap-4 px-6 lg:px-10 justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="rounded-full flex h-10 w-10 items-center justify-center text-zinc-500 hover:bg-zinc-100 lg:hidden transition-colors"
              >
                <Menu className="h-[22px] w-[22px]" />
              </button>
            </div>

            {/* Right side controls */}
            <div className="flex items-center gap-4">
              <div className="relative max-w-sm hidden md:block w-72">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
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
                  className="w-full rounded-2xl bg-[#f7f9fa] py-2.5 pl-11 pr-5 text-[14px] font-medium text-zinc-800 transition-colors placeholder:text-zinc-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-zinc-200 border border-transparent hover:border-zinc-200 shadow-sm"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate("/notifications")}
                  className="relative flex h-11 w-11 items-center justify-center rounded-2xl text-zinc-500 transition-all hover:bg-zinc-50 hover:text-zinc-900 border border-transparent hover:border-zinc-200 shadow-sm bg-white"
                >
                  <Bell className="h-5 w-5" strokeWidth={2} />
                  {unreadNotifications > 0 && (
                    <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
                  )}
                </button>
                <button className="flex h-11 w-11 items-center justify-center rounded-2xl text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-900 border border-transparent hover:border-zinc-200 shadow-sm bg-white">
                  <Settings2 className="h-5 w-5" strokeWidth={2} />
                </button>
              </div>
            </div>
          </header>

          {/* Page content */}
          <div className="relative flex-1 overflow-auto px-4 pb-4 sm:px-6 sm:pb-6 lg:px-10 lg:pb-10 custom-scrollbar">
            <div className="relative h-full animate-in fade-in duration-500">
              <Outlet context={outletContext} />
            </div>
          </div>
        </main>
      </div>
      <AgentChatWidget />
    </div>
  );
}
