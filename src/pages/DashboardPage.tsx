import {
  Building2,
  FileText,
  GraduationCap,
  ListTodo,
  Pin,
  Star,
  Trophy,
  Users,
  ArrowRight,
  Sparkles,
  Clock,
  TrendingUp,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { StatCard } from "../components/ui/StatCard";
import { Badge } from "../components/ui/Badge";
import { usePortalData } from "../hooks/usePortalData";

export function DashboardPage() {
  const { data } = usePortalData();
  if (!data) {
    return null;
  }

  const totalTasks = data.tasks.length;
  const overdueTasks = data.tasks.filter((task) => task.status === "overdue").length;
  const doneTasks = data.tasks.filter((task) => task.status === "done").length;
  const pendingDocs = data.documents.filter((doc) => doc.status === "review").length;
  const pinnedNews = data.news.filter((item) => item.pinned).slice(0, 4);
  const topOffices = [...data.offices].sort((a, b) => b.rating - a.rating).slice(0, 5);
  const recentAtts = [...data.attestations].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Welcome banner */}
      <Card className="overflow-hidden border-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 p-6 text-white shadow-xl shadow-indigo-200/50">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Добро пожаловать в МФО Портал!</h2>
            </div>
            <p className="mt-2 max-w-xl text-sm text-indigo-100">
              Новичок в системе? Пройдите короткое обучение, чтобы узнать о всех возможностях портала.
            </p>
            <Link
              to="/system-guide"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-indigo-600 transition-colors hover:bg-indigo-50"
            >
              Начать обучение
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="hidden lg:block">
            <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
              <GraduationCap className="h-12 w-12 text-white" />
            </div>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={Building2}
          label="Офисов в сети"
          value={data.offices.length}
          variant="indigo"
          sub="активных точек"
        />
        <StatCard
          icon={Users}
          label="Сотрудников"
          value={data.users.length}
          variant="emerald"
          sub="в системе"
        />
        <StatCard
          icon={ListTodo}
          label="Задачи"
          value={`${doneTasks}/${totalTasks}`}
          variant="amber"
          sub={overdueTasks > 0 ? `${overdueTasks} просрочено` : "все в срок"}
        />
        <StatCard
          icon={FileText}
          label="На согласовании"
          value={pendingDocs}
          variant="purple"
          sub="документов"
        />
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Important announcements */}
        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100">
              <Pin className="h-4 w-4 text-red-600" />
            </div>
            <h2 className="font-semibold text-gray-900">Важные объявления</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {pinnedNews.map((item) => (
              <div key={item.id} className="p-5 transition-colors hover:bg-gray-50">
                <div className="flex items-start gap-3">
                  <div className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-red-400" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900">{item.title}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-gray-500">{item.body}</p>
                    <p className="mt-2 text-xs text-gray-400">{item.date}</p>
                  </div>
                </div>
              </div>
            ))}
            {pinnedNews.length === 0 && (
              <div className="p-5 text-center text-sm text-gray-500">Нет важных объявлений</div>
            )}
          </div>
        </Card>

        {/* Top offices */}
        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
              <Trophy className="h-4 w-4 text-amber-600" />
            </div>
            <h2 className="font-semibold text-gray-900">Топ-5 офисов</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {topOffices.map((office, index) => (
              <div key={office.id} className="flex items-center gap-4 p-4 transition-colors hover:bg-gray-50">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold ${
                    index === 0
                      ? "bg-amber-100 text-amber-600"
                      : index === 1
                        ? "bg-gray-200 text-gray-600"
                        : index === 2
                          ? "bg-orange-100 text-orange-600"
                          : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-gray-900">{office.name}</p>
                  <p className="text-xs text-gray-400">{office.city}</p>
                </div>
                <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  <span className="text-sm font-semibold text-amber-700">{office.rating}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Recent attestations */}
        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100">
              <GraduationCap className="h-4 w-4 text-indigo-600" />
            </div>
            <h2 className="font-semibold text-gray-900">Последние аттестации</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {recentAtts.map((attestation) => {
              const user = data.users.find((item) => item.id === attestation.userId);
              const course = data.courses.find((item) => item.id === attestation.courseId);
              return (
                <div key={attestation.id} className="flex items-center justify-between p-4 transition-colors hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-sm text-white">
                      {user?.avatar}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-900">{user?.name}</p>
                      <p className="truncate text-xs text-gray-400">{course?.title}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium text-gray-600">{attestation.score}%</span>
                    <Badge variant={attestation.passed ? "success" : "danger"}>
                      {attestation.passed ? "Сдал" : "Не сдал"}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Overdue tasks */}
        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100">
              <Clock className="h-4 w-4 text-red-600" />
            </div>
            <h2 className="font-semibold text-gray-900">Просроченные задачи</h2>
            {overdueTasks > 0 && (
              <Badge variant="danger" className="ml-auto">
                {overdueTasks}
              </Badge>
            )}
          </div>
          <div className="divide-y divide-gray-50">
            {data.tasks
              .filter((task) => task.status === "overdue")
              .slice(0, 5)
              .map((task) => {
                const assignee = data.users.find((item) => item.id === task.assigneeId);
                const office = data.offices.find((item) => item.id === task.officeId);
                return (
                  <div key={task.id} className="flex items-center gap-3 p-4 transition-colors hover:bg-gray-50">
                    <div className="h-2 w-2 flex-shrink-0 rounded-full bg-red-400" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-gray-900">{task.title}</p>
                      <p className="text-xs text-gray-400">
                        {assignee?.name} • {office?.name}
                      </p>
                    </div>
                  </div>
                );
              })}
            {overdueTasks === 0 && (
              <div className="p-5 text-center">
                <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                  <TrendingUp className="h-6 w-6 text-emerald-600" />
                </div>
                <p className="text-sm text-gray-500">Просроченных задач нет!</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
