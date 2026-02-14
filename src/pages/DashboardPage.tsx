import { Building2, FileText, GraduationCap, ListTodo, Pin, Star, Trophy, Users } from "lucide-react";
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
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Дашборд</h1>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard icon={Building2} label="Офисов" value={data.offices.length} color="bg-indigo-500" sub="в сети" />
        <StatCard icon={Users} label="Сотрудников" value={data.users.length} color="bg-emerald-500" sub="всего" />
        <StatCard icon={ListTodo} label="Задачи" value={`${doneTasks}/${totalTasks}`} color="bg-amber-500" sub={`${overdueTasks} просрочено`} />
        <StatCard icon={FileText} label="На согласовании" value={pendingDocs} color="bg-purple-500" sub="документов" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
        <Card className="p-4 sm:p-5">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <Pin className="h-4 w-4 text-red-500" /> Важные объявления
          </h2>
          <div className="space-y-3">
            {pinnedNews.map((item) => (
              <div key={item.id} className="border-l-4 border-red-400 py-1 pl-3">
                <p className="text-sm font-medium text-gray-900">{item.title}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{item.body}</p>
                <p className="mt-1 text-xs text-gray-400">{item.date}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4 sm:p-5">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <Trophy className="h-4 w-4 text-amber-500" /> Топ-5 офисов
          </h2>
          <div className="space-y-2">
            {topOffices.map((office, index) => (
              <div key={office.id} className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-50 text-xs font-bold text-gray-500">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{office.name}</p>
                  <p className="text-xs text-gray-400">{office.city}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  <span className="text-sm font-semibold">{office.rating}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4 sm:p-5">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <GraduationCap className="h-4 w-4 text-indigo-500" /> Последние аттестации
          </h2>
          <div className="space-y-2">
            {recentAtts.map((attestation) => {
              const user = data.users.find((item) => item.id === attestation.userId);
              const course = data.courses.find((item) => item.id === attestation.courseId);
              return (
                <div key={attestation.id} className="flex items-center justify-between text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{user?.name}</p>
                    <p className="truncate text-xs text-gray-400">{course?.title}</p>
                  </div>
                  <div className="ml-2 flex shrink-0 items-center gap-2">
                    <span className="font-mono text-sm">{attestation.score}%</span>
                    <Badge className={attestation.passed ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                      {attestation.passed ? "Сдал" : "Не сдал"}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-4 sm:p-5">
          <h2 className="mb-3 text-lg font-semibold">Просроченные задачи</h2>
          <div className="space-y-2">
            {data.tasks
              .filter((task) => task.status === "overdue")
              .slice(0, 5)
              .map((task) => {
                const assignee = data.users.find((item) => item.id === task.assigneeId);
                const office = data.offices.find((item) => item.id === task.officeId);
                return (
                  <div key={task.id} className="rounded-r border-l-4 border-red-400 py-1 pl-3 text-sm">
                    <p className="truncate font-medium">{task.title}</p>
                    <p className="text-xs text-gray-400">{assignee?.name} • {office?.name}</p>
                  </div>
                );
              })}
          </div>
        </Card>
      </div>
    </div>
  );
}