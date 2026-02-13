import { useState } from 'react';
import {
  LayoutDashboard, Newspaper, BookOpen, GraduationCap, FileText, ListTodo,
  Building2, Trophy, Users, ChevronDown, Search, Pin, CheckCircle2,
  Circle, AlertTriangle, Clock, Printer, Star, Award,
  ChevronRight, Menu, X, Bell
} from 'lucide-react';
import {
  type Role, type User, type Task, RoleLabels,
  offices, users, news, kbArticles, courses, attestations, tasks, documents
} from './data';

type Page = 'dashboard' | 'news' | 'kb' | 'lms' | 'docs' | 'tasks' | 'org' | 'ratings';

const statusColors: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  done: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800',
  draft: 'bg-gray-100 text-gray-700',
  review: 'bg-orange-100 text-orange-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-700',
};

const statusLabels: Record<string, string> = {
  new: 'Новая', in_progress: 'В работе', done: 'Выполнена', overdue: 'Просрочена',
  draft: 'Черновик', review: 'На согласовании', approved: 'Утверждён', rejected: 'Отклонён',
};

const priorityColors: Record<string, string> = {
  low: 'text-gray-400', medium: 'text-yellow-500', high: 'text-red-500',
};

const typeLabels: Record<string, string> = {
  order: 'Поручение', checklist: 'Чеклист', auto: 'Автоматическая',
  incoming: 'Входящий', outgoing: 'Исходящий', internal: 'Внутренний',
};

// ============ BADGE ============
function Badge({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>{children}</span>;
}

// ============ CARD ============
function Card({ children, className = '', onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={`rounded-xl border border-gray-200 bg-white shadow-sm ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''} ${className}`}>
      {children}
    </div>
  );
}

// ============ STAT CARD ============
function StatCard({ icon: Icon, label, value, color, sub }: { icon: React.ElementType; label: string; value: string | number; color: string; sub?: string }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl ${color}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-gray-500 truncate">{label}</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900">{value}</p>
          {sub && <p className="text-xs text-gray-400 truncate">{sub}</p>}
        </div>
      </div>
    </Card>
  );
}

// ============ MAIN APP ============
export function App() {
  const [currentUser, setCurrentUser] = useState<User>(users[0]); // director by default
  const [page, setPage] = useState<Page>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Detail views
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<typeof kbArticles[0] | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  const navItems: { id: Page; label: string; icon: React.ElementType }[] = [
    { id: 'dashboard', label: 'Дашборд', icon: LayoutDashboard },
    { id: 'news', label: 'Новости', icon: Newspaper },
    { id: 'kb', label: 'База знаний', icon: BookOpen },
    { id: 'lms', label: 'Обучение (LMS)', icon: GraduationCap },
    { id: 'docs', label: 'Документооборот', icon: FileText },
    { id: 'tasks', label: 'Задачи', icon: ListTodo },
    { id: 'org', label: 'Оргструктура', icon: Building2 },
    { id: 'ratings', label: 'Рейтинги', icon: Trophy },
  ];

  const switchUser = (role: Role) => {
    const u = users.find(u => u.role === role);
    if (u) { setCurrentUser(u); setShowUserMenu(false); }
  };

  const navigate = (p: Page) => {
    setPage(p);
    setSidebarOpen(false);
    setSelectedTask(null);
    setSelectedArticle(null);
    setSelectedUserId(null);
  };

  // ============ DASHBOARD ============
  const DashboardPage = () => {
    const totalTasks = tasks.length;
    const overdueTasks = tasks.filter(t => t.status === 'overdue').length;
    const doneTasks = tasks.filter(t => t.status === 'done').length;
    const pendingDocs = documents.filter(d => d.status === 'review').length;
    const pinnedNews = news.filter(n => n.pinned);
    const topOffices = [...offices].sort((a, b) => b.rating - a.rating).slice(0, 5);
    const recentAtts = [...attestations].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Дашборд</h1>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard icon={Building2} label="Офисов" value={offices.length} color="bg-indigo-500" sub="в сети" />
          <StatCard icon={Users} label="Сотрудников" value={users.length} color="bg-emerald-500" sub="всего" />
          <StatCard icon={ListTodo} label="Задачи" value={`${doneTasks}/${totalTasks}`} color="bg-amber-500" sub={`${overdueTasks} просрочено`} />
          <StatCard icon={FileText} label="На согласовании" value={pendingDocs} color="bg-purple-500" sub="документов" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Pinned news */}
          <Card className="p-4 sm:p-5">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Pin className="h-4 w-4 text-red-500" /> Важные объявления</h2>
            <div className="space-y-3">
              {pinnedNews.map(n => (
                <div key={n.id} className="border-l-4 border-red-400 pl-3 py-1">
                  <p className="font-medium text-sm text-gray-900">{n.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
                  <p className="text-xs text-gray-400 mt-1">{n.date}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Top offices */}
          <Card className="p-4 sm:p-5">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-500" /> Топ-5 офисов</h2>
            <div className="space-y-2">
              {topOffices.map((o, i) => (
                <div key={o.id} className="flex items-center gap-3">
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-gray-100 text-gray-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-gray-50 text-gray-500'}`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{o.name}</p>
                    <p className="text-xs text-gray-400">{o.city}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                    <span className="text-sm font-semibold">{o.rating}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Recent attestations */}
          <Card className="p-4 sm:p-5">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><GraduationCap className="h-4 w-4 text-indigo-500" /> Последние аттестации</h2>
            <div className="space-y-2">
              {recentAtts.map(a => {
                const u = users.find(u => u.id === a.userId);
                const c = courses.find(c => c.id === a.courseId);
                return (
                  <div key={a.id} className="flex items-center justify-between text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{u?.name}</p>
                      <p className="text-xs text-gray-400 truncate">{c?.title}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-sm font-mono">{a.score}%</span>
                      <Badge className={a.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                        {a.passed ? 'Сдал' : 'Не сдал'}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Overdue tasks */}
          <Card className="p-4 sm:p-5">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-500" /> Просроченные задачи</h2>
            {tasks.filter(t => t.status === 'overdue').length === 0 ? (
              <p className="text-sm text-gray-400">Нет просроченных задач 🎉</p>
            ) : (
              <div className="space-y-2">
                {tasks.filter(t => t.status === 'overdue').map(t => {
                  const assignee = users.find(u => u.id === t.assigneeId);
                  const office = offices.find(o => o.id === t.officeId);
                  return (
                    <div key={t.id} className="flex items-center justify-between text-sm border-l-4 border-red-400 pl-3 py-1 cursor-pointer hover:bg-red-50 rounded-r" onClick={() => { setPage('tasks'); setSelectedTask(t); }}>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{t.title}</p>
                        <p className="text-xs text-gray-400">{assignee?.name} • {office?.name}</p>
                      </div>
                      <span className="text-xs text-red-500 shrink-0 ml-2">до {t.dueDate}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    );
  };

  // ============ NEWS ============
  const NewsPage = () => {
    const sorted = [...news].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.date.localeCompare(a.date);
    });
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Новости и объявления</h1>
        <div className="space-y-4">
          {sorted.map(n => (
            <Card key={n.id} className="p-4 sm:p-5">
              <div className="flex items-start gap-3">
                {n.pinned && <Pin className="h-4 w-4 text-red-500 mt-1 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900">{n.title}</h3>
                    {n.pinned && <Badge className="bg-red-100 text-red-700">Важно</Badge>}
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">{n.body}</p>
                  <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
                    <span>{n.date}</span>
                    <span>•</span>
                    <span>{n.author}</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  // ============ KB ============
  const KBPage = () => {
    const [catFilter, setCatFilter] = useState('');
    const categories = [...new Set(kbArticles.map(a => a.category))];
    const filtered = kbArticles.filter(a => {
      if (catFilter && a.category !== catFilter) return false;
      if (searchQuery && !a.title.toLowerCase().includes(searchQuery.toLowerCase()) && !a.content.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });

    if (selectedArticle) {
      return (
        <div className="space-y-4">
          <button onClick={() => setSelectedArticle(null)} className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
            ← Назад к списку
          </button>
          <Card className="p-5 sm:p-6">
            <Badge className="bg-indigo-100 text-indigo-700 mb-2">{selectedArticle.category}</Badge>
            <h2 className="text-xl font-bold text-gray-900 mb-1">{selectedArticle.title}</h2>
            <p className="text-xs text-gray-400 mb-4">{selectedArticle.date}</p>
            <p className="text-gray-700 leading-relaxed whitespace-pre-line">{selectedArticle.content}</p>
          </Card>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">База знаний</h1>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setCatFilter('')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${!catFilter ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Все</button>
          {categories.map(c => (
            <button key={c} onClick={() => setCatFilter(c)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${catFilter === c ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{c}</button>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(a => (
            <Card key={a.id} className="p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedArticle(a)}>
              <Badge className="bg-indigo-100 text-indigo-700 mb-2">{a.category}</Badge>
              <h3 className="font-semibold text-gray-900 mb-1">{a.title}</h3>
              <p className="text-sm text-gray-500 line-clamp-2">{a.content}</p>
              <p className="text-xs text-gray-400 mt-2">{a.date}</p>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  // ============ LMS ============
  const LMSPage = () => {
    const [tab, setTab] = useState<'courses' | 'history' | 'employee'>('courses');

    if (selectedUserId) {
      const emp = users.find(u => u.id === selectedUserId)!;
      const empAtts = attestations.filter(a => a.userId === selectedUserId).sort((a, b) => b.date.localeCompare(a.date));
      return (
        <div className="space-y-4">
          <button onClick={() => setSelectedUserId(null)} className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1">← Назад</button>
          <Card className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">{emp.avatar}</span>
              <div>
                <h2 className="text-lg font-bold">{emp.name}</h2>
                <p className="text-sm text-gray-500">{emp.position} • {offices.find(o => o.id === emp.officeId)?.name}</p>
                <div className="flex items-center gap-1 mt-1"><Award className="h-4 w-4 text-amber-500" /><span className="text-sm font-semibold">{emp.points} баллов</span></div>
              </div>
            </div>
            <h3 className="font-semibold mb-2">История аттестаций</h3>
            {empAtts.length === 0 ? <p className="text-sm text-gray-400">Нет пройденных аттестаций</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-left text-gray-500"><th className="pb-2 pr-3">Курс</th><th className="pb-2 pr-3">Дата</th><th className="pb-2 pr-3">Балл</th><th className="pb-2">Результат</th></tr></thead>
                  <tbody>
                    {empAtts.map(a => {
                      const c = courses.find(c => c.id === a.courseId);
                      return (
                        <tr key={a.id} className="border-b last:border-0">
                          <td className="py-2 pr-3">{c?.title}</td>
                          <td className="py-2 pr-3 text-gray-500">{a.date}</td>
                          <td className="py-2 pr-3 font-mono">{a.score}%</td>
                          <td className="py-2"><Badge className={a.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>{a.passed ? 'Сдал' : 'Не сдал'}</Badge></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Обучение (LMS)</h1>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          {([['courses', 'Курсы'], ['history', 'История'], ['employee', 'По сотрудникам']] as const).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${tab === id ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>{label}</button>
          ))}
        </div>

        {tab === 'courses' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {courses.map(c => {
              const passCount = attestations.filter(a => a.courseId === c.id && a.passed).length;
              const totalAttempts = attestations.filter(a => a.courseId === c.id).length;
              return (
                <Card key={c.id} className="p-4">
                  <Badge className="bg-purple-100 text-purple-700 mb-2">{c.category}</Badge>
                  <h3 className="font-semibold text-gray-900 mb-1">{c.title}</h3>
                  <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-2">
                    <span>{c.questionsCount} вопросов</span>
                    <span>Порог: {c.passingScore}%</span>
                    <span>Сдали: {passCount}/{totalAttempts}</span>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {tab === 'history' && (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50 text-left text-gray-500 text-xs uppercase"><th className="px-4 py-3">Сотрудник</th><th className="px-4 py-3">Курс</th><th className="px-4 py-3">Дата</th><th className="px-4 py-3">Балл</th><th className="px-4 py-3">Результат</th></tr></thead>
                <tbody>
                  {[...attestations].sort((a, b) => b.date.localeCompare(a.date)).map(a => {
                    const u = users.find(u => u.id === a.userId);
                    const c = courses.find(c => c.id === a.courseId);
                    return (
                      <tr key={a.id} className="border-t hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium">{u?.name}</td>
                        <td className="px-4 py-2.5 text-gray-600">{c?.title}</td>
                        <td className="px-4 py-2.5 text-gray-500">{a.date}</td>
                        <td className="px-4 py-2.5 font-mono">{a.score}%</td>
                        <td className="px-4 py-2.5"><Badge className={a.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>{a.passed ? 'Сдал' : 'Не сдал'}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {tab === 'employee' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {users.filter(u => u.role !== 'admin').map(u => {
              const uAtts = attestations.filter(a => a.userId === u.id);
              const passed = uAtts.filter(a => a.passed).length;
              return (
                <Card key={u.id} className="p-3 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedUserId(u.id)}>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{u.avatar}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{u.name}</p>
                      <p className="text-xs text-gray-400 truncate">{offices.find(o => o.id === u.officeId)?.name}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-gray-500">{passed}/{uAtts.length} сдано</p>
                      <div className="flex items-center gap-0.5"><Award className="h-3 w-3 text-amber-500" /><span className="text-xs font-semibold">{u.points}</span></div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // ============ DOCS ============
  const DocsPage = () => {
    const [typeFilter, setTypeFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const filtered = documents.filter(d => {
      if (typeFilter && d.type !== typeFilter) return false;
      if (statusFilter && d.status !== statusFilter) return false;
      return true;
    });

    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Документооборот</h1>
        <div className="flex flex-wrap gap-2">
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm bg-white">
            <option value="">Все типы</option>
            <option value="incoming">Входящие</option>
            <option value="outgoing">Исходящие</option>
            <option value="internal">Внутренние</option>
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm bg-white">
            <option value="">Все статусы</option>
            <option value="draft">Черновик</option>
            <option value="review">На согласовании</option>
            <option value="approved">Утверждён</option>
            <option value="rejected">Отклонён</option>
          </select>
        </div>
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 text-left text-gray-500 text-xs uppercase"><th className="px-4 py-3">Документ</th><th className="px-4 py-3">Тип</th><th className="px-4 py-3">Статус</th><th className="px-4 py-3">Автор</th><th className="px-4 py-3">Дата</th></tr></thead>
              <tbody>
                {filtered.map(d => (
                  <tr key={d.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium max-w-[200px] truncate">{d.title}</td>
                    <td className="px-4 py-2.5"><Badge className="bg-gray-100 text-gray-700">{typeLabels[d.type]}</Badge></td>
                    <td className="px-4 py-2.5"><Badge className={statusColors[d.status]}>{statusLabels[d.status]}</Badge></td>
                    <td className="px-4 py-2.5 text-gray-600">{d.author}</td>
                    <td className="px-4 py-2.5 text-gray-500">{d.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  };

  // ============ TASKS ============
  const TasksPage = () => {
    const [statusFilter, setStatusFilter] = useState('');
    const [officeFilter, setOfficeFilter] = useState('');
    const [tasksList, setTasksList] = useState(tasks);

    const filtered = tasksList.filter(t => {
      if (statusFilter && t.status !== statusFilter) return false;
      if (officeFilter && t.officeId !== Number(officeFilter)) return false;
      if (currentUser.role === 'operator') return t.assigneeId === currentUser.id;
      if (currentUser.role === 'office_head') return t.officeId === currentUser.officeId;
      return true;
    });

    const toggleCheckItem = (taskId: number, idx: number) => {
      setTasksList(prev => prev.map(t => {
        if (t.id !== taskId || !t.checklistItems) return t;
        const items = [...t.checklistItems];
        items[idx] = { ...items[idx], done: !items[idx].done };
        return { ...t, checklistItems: items };
      }));
    };

    if (selectedTask) {
      const t = tasksList.find(tt => tt.id === selectedTask.id) || selectedTask;
      const assignee = users.find(u => u.id === t.assigneeId);
      const office = offices.find(o => o.id === t.officeId);
      return (
        <div className="space-y-4">
          <button onClick={() => setSelectedTask(null)} className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1">← Назад к списку</button>
          <Card className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <Badge className={statusColors[t.status]}>{statusLabels[t.status]}</Badge>
              <Badge className="bg-gray-100 text-gray-700">{typeLabels[t.type]}</Badge>
              <span className={`${priorityColors[t.priority]}`}>● {t.priority === 'high' ? 'Высокий' : t.priority === 'medium' ? 'Средний' : 'Низкий'}</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">{t.title}</h2>
            <p className="text-gray-600 mb-4">{t.description}</p>
            <div className="grid grid-cols-2 gap-3 text-sm text-gray-500 mb-4">
              <div><span className="text-gray-400">Исполнитель:</span> {assignee?.name}</div>
              <div><span className="text-gray-400">Офис:</span> {office?.name}</div>
              <div><span className="text-gray-400">Создано:</span> {t.createdDate}</div>
              <div><span className="text-gray-400">Срок:</span> {t.dueDate}</div>
            </div>

            {t.checklistItems && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">Чеклист</h3>
                  <button onClick={() => window.print()} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 print:hidden">
                    <Printer className="h-4 w-4" /> Печать
                  </button>
                </div>
                <div className="space-y-1.5">
                  {t.checklistItems.map((item, idx) => (
                    <label key={idx} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-gray-50 rounded px-2 -mx-2">
                      <input type="checkbox" checked={item.done} onChange={() => toggleCheckItem(t.id, idx)} className="h-4 w-4 rounded border-gray-300 text-indigo-600" />
                      <span className={`text-sm ${item.done ? 'line-through text-gray-400' : 'text-gray-700'}`}>{item.text}</span>
                    </label>
                  ))}
                </div>
                <div className="mt-2 text-xs text-gray-400">
                  Выполнено: {t.checklistItems.filter(i => i.done).length}/{t.checklistItems.length}
                </div>
              </div>
            )}
          </Card>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Задачи</h1>
        <div className="flex flex-wrap gap-2">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm bg-white">
            <option value="">Все статусы</option>
            <option value="new">Новые</option>
            <option value="in_progress">В работе</option>
            <option value="done">Выполнены</option>
            <option value="overdue">Просрочены</option>
          </select>
          {(currentUser.role === 'director' || currentUser.role === 'admin') && (
            <select value={officeFilter} onChange={e => setOfficeFilter(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm bg-white">
              <option value="">Все офисы</option>
              {offices.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          )}
        </div>
        <div className="space-y-2">
          {filtered.map(t => {
            const assignee = users.find(u => u.id === t.assigneeId);
            const office = offices.find(o => o.id === t.officeId);
            return (
              <Card key={t.id} className="p-3 sm:p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedTask(t)}>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {t.status === 'done' ? <CheckCircle2 className="h-5 w-5 text-green-500" /> :
                     t.status === 'overdue' ? <AlertTriangle className="h-5 w-5 text-red-500" /> :
                     t.status === 'in_progress' ? <Clock className="h-5 w-5 text-yellow-500" /> :
                     <Circle className="h-5 w-5 text-blue-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                      <h3 className="font-medium text-sm text-gray-900">{t.title}</h3>
                      <span className={`text-xs ${priorityColors[t.priority]}`}>●</span>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center text-xs text-gray-500">
                      <Badge className={statusColors[t.status]}>{statusLabels[t.status]}</Badge>
                      <Badge className="bg-gray-100 text-gray-600">{typeLabels[t.type]}</Badge>
                      <span>{assignee?.name}</span>
                      <span>•</span>
                      <span>{office?.name}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-gray-400">до {t.dueDate}</p>
                    <ChevronRight className="h-4 w-4 text-gray-300 ml-auto mt-1" />
                  </div>
                </div>
              </Card>
            );
          })}
          {filtered.length === 0 && <p className="text-center text-gray-400 py-8">Нет задач по выбранным фильтрам</p>}
        </div>
      </div>
    );
  };

  // ============ ORG ============
  const OrgPage = () => {
    const [selectedOffice, setSelectedOffice] = useState<number | null>(null);
    const director = users.find(u => u.role === 'director');

    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Оргструктура и контакты</h1>

        {/* Director */}
        {director && (
          <Card className="p-4 border-l-4 border-indigo-500">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{director.avatar}</span>
              <div>
                <p className="font-bold text-gray-900">{director.name}</p>
                <p className="text-sm text-indigo-600">{director.position}</p>
                <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                  <span>{director.email}</span>
                  <span>{director.phone}</span>
                </div>
              </div>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {offices.map(o => {
            const staff = users.filter(u => u.officeId === o.id && u.role !== 'director' && u.role !== 'admin');
            const isOpen = selectedOffice === o.id;
            return (
              <Card key={o.id} className="overflow-hidden">
                <div className="p-4 cursor-pointer" onClick={() => setSelectedOffice(isOpen ? null : o.id)}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{o.name}</h3>
                      <p className="text-sm text-gray-500">{o.city}, {o.address}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1"><Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" /><span className="text-sm font-semibold">{o.rating}</span></div>
                      <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </div>
                </div>
                {isOpen && (
                  <div className="border-t px-4 py-3 bg-gray-50 space-y-2">
                    {staff.map(s => (
                      <div key={s.id} className="flex items-center gap-2 text-sm">
                        <span className="text-lg">{s.avatar}</span>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{s.name}</p>
                          <p className="text-xs text-gray-400">{RoleLabels[s.role]}</p>
                        </div>
                        <div className="text-right text-xs text-gray-400 shrink-0">
                          <p>{s.phone}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    );
  };

  // ============ RATINGS ============
  const RatingsPage = () => {
    const [tab, setTab] = useState<'offices' | 'employees'>('offices');
    const sortedOffices = [...offices].sort((a, b) => b.rating - a.rating);
    const sortedUsers = [...users].filter(u => u.role !== 'admin').sort((a, b) => b.points - a.points);

    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Рейтинги</h1>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          <button onClick={() => setTab('offices')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${tab === 'offices' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Офисы</button>
          <button onClick={() => setTab('employees')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${tab === 'employees' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Сотрудники</button>
        </div>

        {tab === 'offices' && (
          <div className="space-y-2">
            {sortedOffices.map((o, i) => {
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
              return (
                <Card key={o.id} className={`p-4 ${i < 3 ? 'border-l-4' : ''} ${i === 0 ? 'border-amber-400' : i === 1 ? 'border-gray-400' : i === 2 ? 'border-orange-400' : ''}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl w-8 text-center">{medal || `${i + 1}`}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900">{o.name}</p>
                      <p className="text-sm text-gray-500">{o.city}</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1"><Star className="h-4 w-4 text-amber-400 fill-amber-400" /><span className="text-lg font-bold">{o.rating}</span></div>
                      <div className="w-24 bg-gray-200 rounded-full h-1.5 mt-1">
                        <div className="bg-amber-400 h-1.5 rounded-full" style={{ width: `${o.rating}%` }}></div>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {tab === 'employees' && (
          <div className="space-y-2">
            {sortedUsers.map((u, i) => {
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
              const office = offices.find(o => o.id === u.officeId);
              return (
                <Card key={u.id} className={`p-3 ${i < 3 ? 'border-l-4' : ''} ${i === 0 ? 'border-amber-400' : i === 1 ? 'border-gray-400' : i === 2 ? 'border-orange-400' : ''}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-lg w-6 text-center">{medal || `${i + 1}`}</span>
                    <span className="text-2xl">{u.avatar}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900 truncate">{u.name}</p>
                      <p className="text-xs text-gray-400 truncate">{RoleLabels[u.role]} • {office?.name}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Award className="h-4 w-4 text-amber-500" />
                      <span className="font-bold text-sm">{u.points}</span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // ============ RENDER PAGES ============
  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <DashboardPage />;
      case 'news': return <NewsPage />;
      case 'kb': return <KBPage />;
      case 'lms': return <LMSPage />;
      case 'docs': return <DocsPage />;
      case 'tasks': return <TasksPage />;
      case 'org': return <OrgPage />;
      case 'ratings': return <RatingsPage />;
    }
  };

  // ============ MAIN LAYOUT ============
  return (
    <div className="flex h-screen bg-gray-50 print:block">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-gradient-to-b from-slate-900 to-slate-800 text-white transform transition-transform lg:relative lg:translate-x-0 print:hidden ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-indigo-500 flex items-center justify-center text-sm font-bold">МФ</div>
            <span className="font-bold text-lg">МФО Портал</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="px-3 py-4 space-y-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const active = page === item.id;
            return (
              <button key={item.id} onClick={() => navigate(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${active ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}>
                <Icon className="h-4.5 w-4.5 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User role switcher at bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-slate-700">
          <div className="relative">
            <button onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition text-sm">
              <span className="text-lg">{currentUser.avatar}</span>
              <div className="flex-1 text-left min-w-0">
                <p className="font-medium text-sm truncate">{currentUser.name}</p>
                <p className="text-xs text-slate-400">{RoleLabels[currentUser.role]}</p>
              </div>
              <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
            </button>
            {showUserMenu && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-slate-800 border border-slate-600 rounded-lg shadow-lg overflow-hidden">
                <p className="px-3 py-2 text-xs text-slate-400 border-b border-slate-700">Переключить роль</p>
                {(['director', 'office_head', 'operator', 'admin'] as Role[]).map(r => (
                  <button key={r} onClick={() => switchUser(r)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-700 transition ${currentUser.role === r ? 'text-indigo-400 bg-slate-700/50' : 'text-slate-300'}`}>
                    {RoleLabels[r]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-14 bg-white border-b border-gray-200 flex items-center gap-3 px-4 shrink-0 print:hidden">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-gray-500 hover:text-gray-700">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1 flex items-center gap-3">
            <div className="relative max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input type="text" placeholder="Поиск..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="relative p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />
            </button>
            <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-gray-200">
              <span className="text-lg">{currentUser.avatar}</span>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900 leading-tight">{currentUser.name}</p>
                <p className="text-xs text-gray-400">{RoleLabels[currentUser.role]}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-auto p-4 sm:p-6">
          {renderPage()}
        </div>
      </main>
    </div>
  );
}
