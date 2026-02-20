import { Download, FileBarChart } from "lucide-react";
import { useMemo, useState } from "react";
import { downloadReportRunCsv, exportRowsAsCsv } from "../application/reports/reportUseCases";
import { Card } from "../components/ui/Card";
import { useAuth } from "../contexts/useAuth";
import { RoleLabels, type Role } from "../domain/models";
import {
  useCreateReportScheduleMutation,
  useKpiReportQuery,
  usePortalData,
  useReportRunsQuery,
  useReportSchedulesQuery,
  useReportsDrilldownQuery,
  useRunReportScheduleMutation,
  useUpdateReportScheduleMutation,
} from "../hooks/usePortalData";
import { canAccessReports } from "../lib/permissions";
import { portalRepository } from "../services/portalRepository";

export function ReportsPage() {
  const { data } = usePortalData();
  const { user } = useAuth();
  const userRole = user?.role;
  const userOfficeId = user?.officeId ?? 0;
  const [days, setDays] = useState(30);
  const [officeId, setOfficeId] = useState<number | "all">("all");
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");
  const [scheduleName, setScheduleName] = useState("");
  const [scheduleRecipient, setScheduleRecipient] = useState("");
  const [scheduleFrequency, setScheduleFrequency] = useState<"daily" | "weekly" | "monthly">("weekly");

  const canManageSchedules = userRole === "admin" || userRole === "director";
  const effectiveOfficeId = userRole === "office_head" && userOfficeId > 0 ? userOfficeId : officeId === "all" ? undefined : officeId;
  const kpi = useKpiReportQuery({ days, officeId: effectiveOfficeId });
  const drilldown = useReportsDrilldownQuery({
    days,
    officeId: effectiveOfficeId,
    role: roleFilter === "all" ? undefined : roleFilter,
  });
  const schedules = useReportSchedulesQuery(canManageSchedules);
  const runs = useReportRunsQuery(undefined, canManageSchedules);
  const createSchedule = useCreateReportScheduleMutation();
  const toggleSchedule = useUpdateReportScheduleMutation();
  const runSchedule = useRunReportScheduleMutation();
  const availableOffices = useMemo(() => {
    if (!data) return [];
    if (userRole === "office_head") {
      return data.offices.filter((office) => office.id === userOfficeId);
    }
    return data.offices;
  }, [data, userOfficeId, userRole]);
  const reportManagers = useMemo(
    () => (userRole === "admin" || userRole === "director" ? data?.users.filter((u) => u.role !== "operator") ?? [] : []),
    [data?.users, userRole],
  );

  if (!user) {
    return null;
  }

  if (!canAccessReports(user.role)) {
    return <p className="text-sm text-red-500">Доступ запрещен.</p>;
  }

  const rows = kpi.data?.byOffice ?? [];
  const totals = kpi.data?.totals;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-gray-900">Отчеты</h1>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={String(days)}
            onChange={(event) => setDays(Number(event.target.value))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value={7}>Последние 7 дней</option>
            <option value={30}>Последние 30 дней</option>
            <option value={90}>Последние 90 дней</option>
          </select>
          {user.role !== "office_head" ? (
            <select
              value={String(officeId)}
              onChange={(event) =>
                setOfficeId(event.target.value === "all" ? "all" : Number(event.target.value))
              }
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="all">Все офисы</option>
              {availableOffices.map((office) => (
                <option key={office.id} value={office.id}>
                  {office.name}
                </option>
              ))}
            </select>
          ) : null}
          <select
            value={String(roleFilter)}
            onChange={(event) => setRoleFilter(event.target.value as Role | "all")}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="all">Все роли</option>
            {(drilldown.data?.availableRoles ?? []).map((role) => (
              <option key={role} value={role}>
                {RoleLabels[role]}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              exportRowsAsCsv(rows, "reports");
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
          >
            <Download className="h-4 w-4" />
            Экспорт CSV
          </button>
        </div>
      </div>

      {kpi.isLoading ? <p className="text-sm text-gray-500">Загрузка KPI...</p> : null}
      {kpi.isError ? <p className="text-sm text-red-500">Не удалось загрузить KPI-отчёт.</p> : null}
      {drilldown.isLoading ? <p className="text-sm text-gray-500">Загрузка drill-down...</p> : null}
      {drilldown.isError ? <p className="text-sm text-red-500">Не удалось загрузить drill-down отчёт.</p> : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <p className="text-sm text-gray-500">Выполнение задач</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{totals?.taskCompletionRate ?? 0}%</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">Просроченные задачи</p>
          <p className="mt-2 text-2xl font-bold text-red-600">{totals?.tasksOverdue ?? 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">Throughput согласований</p>
          <p className="mt-2 text-2xl font-bold text-amber-600">{totals?.approvalsThroughputPerDay ?? 0}/день</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">LMS completion</p>
          <p className="mt-2 text-2xl font-bold text-cyan-700">{totals?.lmsCompletionRate ?? 0}%</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Card className="p-4">
          <p className="text-sm text-gray-500">Документы в review</p>
          <p className="mt-2 text-xl font-bold text-gray-900">{totals?.docsReview ?? 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">Среднее время согласования</p>
          <p className="mt-2 text-xl font-bold text-gray-900">{totals?.approvalsAvgHours ?? 0} ч</p>
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
                <th className="px-2 py-2">Док. завершено</th>
                <th className="px-2 py-2">LMS назначено</th>
                <th className="px-2 py-2">LMS сдано</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.officeId} className="border-t border-gray-200">
                  <td className="px-2 py-2 font-medium text-gray-900">{row.office}</td>
                  <td className="px-2 py-2">{row.tasksTotal}</td>
                  <td className="px-2 py-2">{row.tasksDone} ({row.taskCompletionRate}%)</td>
                  <td className="px-2 py-2 text-red-600">{row.tasksOverdue}</td>
                  <td className="px-2 py-2">{row.docsReview}</td>
                  <td className="px-2 py-2">{row.docsFinalized}</td>
                  <td className="px-2 py-2">{row.lmsAssigned}</td>
                  <td className="px-2 py-2">{row.lmsPassed} ({row.lmsCompletionRate}%)</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 font-semibold text-gray-900">Drill-down по ролям</h2>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="px-2 py-2">Роль</th>
                <th className="px-2 py-2">Сотрудники</th>
                <th className="px-2 py-2">Задачи</th>
                <th className="px-2 py-2">Просрочено</th>
                <th className="px-2 py-2">LMS</th>
                <th className="px-2 py-2">Документы</th>
                <th className="px-2 py-2">Согласования</th>
              </tr>
            </thead>
            <tbody>
              {(drilldown.data?.byRole ?? []).map((row) => (
                <tr key={row.role} className="border-t border-gray-200">
                  <td className="px-2 py-2 font-medium text-gray-900">{RoleLabels[row.role]}</td>
                  <td className="px-2 py-2">{row.usersCount}</td>
                  <td className="px-2 py-2">{row.tasksDone}/{row.tasksTotal} ({row.taskCompletionRate}%)</td>
                  <td className="px-2 py-2 text-red-600">{row.tasksOverdue}</td>
                  <td className="px-2 py-2">{row.lmsPassed}/{row.lmsAssigned} ({row.lmsCompletionRate}%)</td>
                  <td className="px-2 py-2">{row.docsAuthored}</td>
                  <td className="px-2 py-2">{row.approvalsHandled}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 font-semibold text-gray-900">Drill-down по сотрудникам</h2>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="px-2 py-2">Сотрудник</th>
                <th className="px-2 py-2">Роль</th>
                <th className="px-2 py-2">Задачи</th>
                <th className="px-2 py-2">Просрочено</th>
                <th className="px-2 py-2">LMS</th>
                <th className="px-2 py-2">Документы</th>
                <th className="px-2 py-2">Согласования</th>
              </tr>
            </thead>
            <tbody>
              {(drilldown.data?.byUser ?? []).slice(0, 100).map((row) => (
                <tr key={row.userId} className="border-t border-gray-200">
                  <td className="px-2 py-2 font-medium text-gray-900">{row.fullName}</td>
                  <td className="px-2 py-2">{RoleLabels[row.role]}</td>
                  <td className="px-2 py-2">{row.tasksDone}/{row.tasksTotal}</td>
                  <td className="px-2 py-2 text-red-600">{row.tasksOverdue}</td>
                  <td className="px-2 py-2">{row.lmsPassed}/{row.lmsAssigned}</td>
                  <td className="px-2 py-2">{row.docsAuthored}</td>
                  <td className="px-2 py-2">{row.approvalsHandled}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {canManageSchedules ? (
        <Card className="p-4">
          <h2 className="mb-3 font-semibold text-gray-900">Плановая доставка отчётов</h2>
          <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-4">
            <input
              value={scheduleName}
              onChange={(event) => setScheduleName(event.target.value)}
              placeholder="Название расписания"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <select
              value={scheduleRecipient}
              onChange={(event) => setScheduleRecipient(event.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Получатель</option>
              {reportManagers.map((member) => (
                <option key={String(member.id)} value={String(member.id)}>
                  {member.name} ({RoleLabels[member.role]})
                </option>
              ))}
            </select>
            <select
              value={scheduleFrequency}
              onChange={(event) => setScheduleFrequency(event.target.value as "daily" | "weekly" | "monthly")}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="daily">Ежедневно</option>
              <option value="weekly">Еженедельно</option>
              <option value="monthly">Ежемесячно</option>
            </select>
            <button
              onClick={() => {
                if (!scheduleName.trim() || !scheduleRecipient) return;
                createSchedule.mutate({
                  name: scheduleName.trim(),
                  recipientUserId: scheduleRecipient,
                  officeId: effectiveOfficeId,
                  roleFilter: roleFilter === "all" ? undefined : roleFilter,
                  daysWindow: days,
                  frequency: scheduleFrequency,
                });
                setScheduleName("");
                setScheduleRecipient("");
              }}
              className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700"
            >
              Добавить расписание
            </button>
          </div>

          <div className="space-y-2">
            {(schedules.data ?? []).map((item) => {
              const recipient = data?.users.find((u) => String(u.id) === item.recipientUserId);
              return (
                <div key={item.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 p-2 text-sm">
                  <span className="font-medium text-gray-900">{item.name}</span>
                  <span className="text-gray-500">
                    {recipient?.name ?? item.recipientUserId} • {item.frequency} • окно {item.daysWindow}д
                  </span>
                  <span className="text-gray-500">след: {new Date(item.nextRunAt).toLocaleString()}</span>
                  <button
                    onClick={() => runSchedule.mutate(item.id)}
                    className="rounded border border-teal-300 px-2 py-1 text-teal-700 hover:bg-teal-50"
                  >
                    Запустить сейчас
                  </button>
                  <button
                    onClick={() =>
                      toggleSchedule.mutate({
                        id: item.id,
                        patch: { isActive: !item.isActive },
                      })
                    }
                    className="rounded border border-gray-300 px-2 py-1 text-gray-700 hover:bg-gray-50"
                  >
                    {item.isActive ? "Отключить" : "Включить"}
                  </button>
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}

      {canManageSchedules ? (
        <Card className="p-4">
          <h2 className="mb-3 font-semibold text-gray-900">Последние выгрузки</h2>
          <div className="space-y-2">
            {(runs.data ?? []).slice(0, 20).map((run) => (
              <div key={run.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 p-2 text-sm">
                <span className="font-medium text-gray-900">#{run.id}</span>
                <span className="text-gray-500">
                  {new Date(run.generatedAt).toLocaleString()} • строк {run.rowsCount}
                </span>
                <button
                  onClick={async () => {
                    await downloadReportRunCsv(run.id, run.fileName, portalRepository);
                  }}
                  className="rounded border border-gray-300 px-2 py-1 text-gray-700 hover:bg-gray-50"
                >
                  Скачать CSV
                </button>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

