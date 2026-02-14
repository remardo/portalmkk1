import { Download, FileBarChart } from "lucide-react";
import { Card } from "../components/ui/Card";
import { useAuth } from "../contexts/useAuth";
import { usePortalData } from "../hooks/usePortalData";
import { canAccessReports } from "../lib/permissions";

function toCsv(rows: Array<Record<string, string | number>>) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const esc = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
  const body = rows.map((row) => headers.map((header) => esc(row[header] ?? "")).join(","));
  return [headers.join(","), ...body].join("\n");
}

export function ReportsPage() {
  const { data } = usePortalData();
  const { user } = useAuth();

  if (!data || !user) {
    return null;
  }

  if (!canAccessReports(user.role)) {
    return <p className="text-sm text-red-500">Доступ запрещен.</p>;
  }

  const today = new Date().toISOString().slice(0, 10);
  const offices = user.role === "office_head" ? data.offices.filter((o) => o.id === user.officeId) : data.offices;

  const rows = offices.map((office) => {
    const officeUsers = data.users.filter((u) => u.officeId === office.id).map((u) => String(u.id));
    const officeTasks = data.tasks.filter((t) => t.officeId === office.id);
    const tasksDone = officeTasks.filter((t) => t.status === "done").length;
    const tasksOverdue = officeTasks.filter((t) => t.status === "overdue" || (t.status !== "done" && t.dueDate < today)).length;

    const officeDocuments = data.documents.filter((d) => d.officeId === office.id);
    const docsReview = officeDocuments.filter((d) => d.status === "review").length;
    const docsRejected = officeDocuments.filter((d) => d.status === "rejected").length;

    const officeAssignments = data.courseAssignments.filter((a) => officeUsers.includes(String(a.userId)));
    const lmsAssigned = officeAssignments.length;
    const lmsPassed = officeAssignments.filter((assignment) =>
      data.courseAttempts.some(
        (attempt) =>
          attempt.courseId === assignment.courseId &&
          String(attempt.userId) === String(assignment.userId) &&
          attempt.passed,
      ),
    ).length;
    const lmsOverdue = officeAssignments.filter((assignment) => {
      if (!assignment.dueDate) return false;
      const passed = data.courseAttempts.some(
        (attempt) =>
          attempt.courseId === assignment.courseId &&
          String(attempt.userId) === String(assignment.userId) &&
          attempt.passed,
      );
      return !passed && assignment.dueDate < today;
    }).length;

    const tasksCompletionRate = officeTasks.length > 0 ? Math.round((tasksDone / officeTasks.length) * 100) : 0;
    const lmsCompletionRate = lmsAssigned > 0 ? Math.round((lmsPassed / lmsAssigned) * 100) : 0;

    return {
      officeId: office.id,
      office: office.name,
      tasksTotal: officeTasks.length,
      tasksDone,
      tasksOverdue,
      tasksCompletionRate,
      docsReview,
      docsRejected,
      lmsAssigned,
      lmsPassed,
      lmsOverdue,
      lmsCompletionRate,
    };
  });

  const totalTasks = rows.reduce((sum, row) => sum + row.tasksTotal, 0);
  const totalTasksOverdue = rows.reduce((sum, row) => sum + row.tasksOverdue, 0);
  const totalDocsReview = rows.reduce((sum, row) => sum + row.docsReview, 0);
  const totalLmsOverdue = rows.reduce((sum, row) => sum + row.lmsOverdue, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-gray-900">Отчеты</h1>
        <button
          onClick={() => {
            const csv = toCsv(rows);
            const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `reports-${new Date().toISOString().slice(0, 10)}.csv`;
            link.click();
            URL.revokeObjectURL(url);
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
        >
          <Download className="h-4 w-4" />
          Экспорт CSV
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <p className="text-sm text-gray-500">Всего задач</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{totalTasks}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">Просроченные задачи</p>
          <p className="mt-2 text-2xl font-bold text-red-600">{totalTasksOverdue}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">Документы на согласовании</p>
          <p className="mt-2 text-2xl font-bold text-amber-600">{totalDocsReview}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">LMS просрочки</p>
          <p className="mt-2 text-2xl font-bold text-purple-700">{totalLmsOverdue}</p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <FileBarChart className="h-4 w-4 text-gray-500" />
          <h2 className="font-semibold text-gray-900">Сводка по офисам</h2>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="px-2 py-2">Офис</th>
                <th className="px-2 py-2">Задачи</th>
                <th className="px-2 py-2">Выполнено</th>
                <th className="px-2 py-2">Просрочено</th>
                <th className="px-2 py-2">Док. review</th>
                <th className="px-2 py-2">LMS назначено</th>
                <th className="px-2 py-2">LMS сдано</th>
                <th className="px-2 py-2">LMS просрочено</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.officeId} className="border-t border-gray-200">
                  <td className="px-2 py-2 font-medium text-gray-900">{row.office}</td>
                  <td className="px-2 py-2">{row.tasksTotal}</td>
                  <td className="px-2 py-2">{row.tasksDone} ({row.tasksCompletionRate}%)</td>
                  <td className="px-2 py-2 text-red-600">{row.tasksOverdue}</td>
                  <td className="px-2 py-2">{row.docsReview}</td>
                  <td className="px-2 py-2">{row.lmsAssigned}</td>
                  <td className="px-2 py-2">{row.lmsPassed} ({row.lmsCompletionRate}%)</td>
                  <td className="px-2 py-2 text-purple-700">{row.lmsOverdue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
