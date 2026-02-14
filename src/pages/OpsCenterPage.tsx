import { AlertTriangle, CheckCircle2, Clock3, FileWarning, GraduationCap, ListTodo } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { useAuth } from "../contexts/useAuth";
import {
  usePortalData,
  useRunOpsEscalationsMutation,
  useRunOpsRemindersMutation,
} from "../hooks/usePortalData";

function daysUntil(date: string) {
  const now = new Date();
  const target = new Date(`${date}T23:59:59`);
  const diffMs = target.getTime() - now.getTime();
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

export function OpsCenterPage() {
  const { data } = usePortalData();
  const { user } = useAuth();
  const runEscalations = useRunOpsEscalationsMutation();
  const runReminders = useRunOpsRemindersMutation();

  if (!data) {
    return null;
  }

  const openTasks = data.tasks.filter((task) => task.status !== "done");
  const overdueTasks = openTasks.filter((task) => daysUntil(task.dueDate) < 0 || task.status === "overdue");
  const soonTasks = openTasks.filter((task) => {
    const days = daysUntil(task.dueDate);
    return days >= 0 && days <= 2;
  });

  const reviewDocuments = data.documents.filter((item) => item.status === "review");
  const rejectedDocuments = data.documents.filter((item) => item.status === "rejected");

  const pendingAssignments = data.courseAssignments.filter((assignment) => {
    const hasPassed = data.courseAttempts.some(
      (attempt) => attempt.courseId === assignment.courseId && attempt.userId === assignment.userId && attempt.passed,
    );
    return !hasPassed;
  });

  const overdueAssignments = pendingAssignments.filter((assignment) => {
    if (!assignment.dueDate) return false;
    return daysUntil(assignment.dueDate) < 0;
  });

  const upcomingAssignments = pendingAssignments.filter((assignment) => {
    if (!assignment.dueDate) return false;
    const days = daysUntil(assignment.dueDate);
    return days >= 0 && days <= 3;
  });

  const highRiskUsers = data.users
    .map((user) => {
      const userOverdueTasks = overdueTasks.filter((task) => String(task.assigneeId) === String(user.id)).length;
      const userOverdueAssignments = overdueAssignments.filter((item) => String(item.userId) === String(user.id)).length;
      return { user, risk: userOverdueTasks + userOverdueAssignments };
    })
    .filter((item) => item.risk > 0)
    .sort((a, b) => b.risk - a.risk)
    .slice(0, 10);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Операционный центр</h1>
      {user?.role === "admin" || user?.role === "director" ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => runEscalations.mutate()}
            disabled={runEscalations.isPending}
            className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {runEscalations.isPending ? "Запуск..." : "Запустить SLA-эскалацию"}
          </button>
          <button
            onClick={() => runReminders.mutate()}
            disabled={runReminders.isPending}
            className="rounded-lg bg-indigo-700 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {runReminders.isPending ? "Запуск..." : "Запустить напоминания"}
          </button>
          {runEscalations.data ? (
            <p className="text-sm text-gray-600">Обновлено задач: {runEscalations.data.updatedCount}</p>
          ) : null}
          {runReminders.data ? (
            <p className="text-sm text-gray-600">
              Напоминания: задачи {runReminders.data.taskReminders}, LMS {runReminders.data.lmsReminders}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Открытые задачи</p>
            <ListTodo className="h-4 w-4 text-indigo-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900">{openTasks.length}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Просроченные задачи</p>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-red-600">{overdueTasks.length}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Документы на согласовании</p>
            <FileWarning className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-600">{reviewDocuments.length}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">LMS просрочки</p>
            <GraduationCap className="h-4 w-4 text-purple-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-purple-700">{overdueAssignments.length}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Задачи с ближайшим SLA (2 дня)</h2>
            <Link to="/tasks" className="text-xs text-indigo-600 hover:text-indigo-800">
              Открыть задачи
            </Link>
          </div>
          <div className="space-y-2">
            {soonTasks.slice(0, 8).map((task) => (
              <div key={task.id} className="rounded-lg border border-gray-200 p-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-gray-900">{task.title}</p>
                  <Badge className="bg-amber-100 text-amber-700">до {task.dueDate}</Badge>
                </div>
                <p className="text-xs text-gray-500">
                  {data.users.find((u) => String(u.id) === String(task.assigneeId))?.name ?? "Не назначен"}
                </p>
              </div>
            ))}
            {soonTasks.length === 0 ? <p className="text-sm text-gray-500">Нет задач с критичным сроком.</p> : null}
          </div>
        </Card>

        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">LMS дедлайны (3 дня)</h2>
            <Link to="/lms" className="text-xs text-indigo-600 hover:text-indigo-800">
              Открыть LMS
            </Link>
          </div>
          <div className="space-y-2">
            {upcomingAssignments.slice(0, 8).map((item) => (
              <div key={item.id} className="rounded-lg border border-gray-200 p-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-gray-900">
                    {data.courses.find((course) => course.id === item.courseId)?.title ?? `Курс #${item.courseId}`}
                  </p>
                  <Badge className="bg-purple-100 text-purple-700">до {item.dueDate}</Badge>
                </div>
                <p className="text-xs text-gray-500">
                  {data.users.find((u) => String(u.id) === String(item.userId))?.name ?? "Неизвестный сотрудник"}
                </p>
              </div>
            ))}
            {upcomingAssignments.length === 0 ? (
              <p className="text-sm text-gray-500">Нет ближайших LMS-дедлайнов.</p>
            ) : null}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Документы, требующие действий</h2>
            <Link to="/docs" className="text-xs text-indigo-600 hover:text-indigo-800">
              Открыть документы
            </Link>
          </div>
          <div className="space-y-2">
            {reviewDocuments.slice(0, 8).map((doc) => (
              <div key={doc.id} className="rounded-lg border border-gray-200 p-2 text-sm">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-gray-900">{doc.title}</p>
                  <Badge className="bg-amber-100 text-amber-700">review</Badge>
                </div>
                <p className="text-xs text-gray-500">{doc.author}</p>
              </div>
            ))}
            {reviewDocuments.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-green-700">
                <CheckCircle2 className="h-4 w-4" />
                <span>Очередь согласования пуста.</span>
              </div>
            ) : null}
            {rejectedDocuments.length > 0 ? (
              <p className="pt-1 text-xs text-red-600">Отклонено документов: {rejectedDocuments.length}</p>
            ) : null}
          </div>
        </Card>

        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Риск по сотрудникам</h2>
            <Clock3 className="h-4 w-4 text-gray-400" />
          </div>
          <div className="space-y-2">
            {highRiskUsers.map((item) => (
              <div key={String(item.user.id)} className="flex items-center justify-between rounded-lg border border-gray-200 p-2 text-sm">
                <p className="font-medium text-gray-900">{item.user.name}</p>
                <Badge className="bg-red-100 text-red-700">{item.risk} просрочек</Badge>
              </div>
            ))}
            {highRiskUsers.length === 0 ? (
              <p className="text-sm text-gray-500">Критичных рисков по сотрудникам нет.</p>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
