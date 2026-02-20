import { useState, type FormEvent } from "react";
import { AlertTriangle, CheckCircle2, Clock3, FileWarning, GraduationCap, ListTodo, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { useAuth } from "../contexts/useAuth";
import { buildOpsCenterInsights } from "../domain/services/opsCenterInsights";
import {
  useAdminAuditQuery,
  useAdminSloStatusQuery,
  useCreateSloRoutingPolicyMutation,
  useDeleteSloRoutingPolicyMutation,
  usePortalData,
  useRunOpsEscalationsMutation,
  useRunOpsRemindersMutation,
  useRunOpsSloCheckMutation,
  useSloRoutingPoliciesQuery,
  useUpdateSloRoutingPolicyMutation,
} from "../hooks/usePortalData";

export function OpsCenterPage() {
  const { data } = usePortalData();
  const { user } = useAuth();
  const isOpsAdmin = user?.role === "admin" || user?.role === "director";
  const sloStatusQuery = useAdminSloStatusQuery({ enabled: isOpsAdmin });
  const sloAuditQuery = useAdminAuditQuery({
    limit: 5,
    action: "ops.slo.alert_check",
    enabled: isOpsAdmin,
  });
  const runEscalations = useRunOpsEscalationsMutation();
  const runReminders = useRunOpsRemindersMutation();
  const runSloCheck = useRunOpsSloCheckMutation();
  const sloRoutingPoliciesQuery = useSloRoutingPoliciesQuery(isOpsAdmin);
  const createSloRoutingPolicy = useCreateSloRoutingPolicyMutation();
  const updateSloRoutingPolicy = useUpdateSloRoutingPolicyMutation();
  const deleteSloRoutingPolicy = useDeleteSloRoutingPolicyMutation();
  const [routingForm, setRoutingForm] = useState<{
    name: string;
    breachType: "any" | "api_error_rate" | "api_latency_p95" | "notification_failure_rate";
    severity: "any" | "warning" | "critical";
    priority: number;
    channels: Array<"webhook" | "email" | "messenger">;
  }>({
    name: "",
    breachType: "any",
    severity: "warning",
    priority: 100,
    channels: ["webhook", "email"],
  });
  const [editingPolicyId, setEditingPolicyId] = useState<number | null>(null);
  const [editingPolicyDraft, setEditingPolicyDraft] = useState<{
    name: string;
    breachType: "any" | "api_error_rate" | "api_latency_p95" | "notification_failure_rate";
    severity: "any" | "warning" | "critical";
    priority: number;
    channels: Array<"webhook" | "email" | "messenger">;
    isActive: boolean;
  } | null>(null);

  if (!data) {
    return null;
  }

  const { openTasks, overdueTasks, soonTasks, reviewDocuments, rejectedDocuments, overdueAssignments, upcomingAssignments, highRiskUsers } =
    buildOpsCenterInsights(data);

  const toggleRoutingChannel = (channel: "webhook" | "email" | "messenger") => {
    setRoutingForm((current) => {
      const hasChannel = current.channels.includes(channel);
      if (hasChannel) {
        const next = current.channels.filter((item) => item !== channel);
        return {
          ...current,
          channels: next.length > 0 ? next : current.channels,
        };
      }
      return { ...current, channels: [...current.channels, channel] };
    });
  };

  const onCreateRoutingPolicy = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedName = routingForm.name.trim();
    if (!normalizedName || routingForm.channels.length === 0) {
      return;
    }
    createSloRoutingPolicy.mutate(
      {
        name: normalizedName,
        breachType: routingForm.breachType,
        severity: routingForm.severity,
        priority: routingForm.priority,
        channels: routingForm.channels,
        isActive: true,
      },
      {
        onSuccess: () => {
          setRoutingForm((current) => ({ ...current, name: "" }));
        },
      },
    );
  };

  const startEditRoutingPolicy = (policy: NonNullable<typeof sloRoutingPoliciesQuery.data>[number]) => {
    setEditingPolicyId(policy.id);
    setEditingPolicyDraft({
      name: policy.name,
      breachType: policy.breachType,
      severity: policy.severity,
      priority: policy.priority,
      channels: [...policy.channels],
      isActive: policy.isActive,
    });
  };

  const toggleEditingChannel = (channel: "webhook" | "email" | "messenger") => {
    setEditingPolicyDraft((current) => {
      if (!current) return current;
      const hasChannel = current.channels.includes(channel);
      if (hasChannel) {
        const next = current.channels.filter((item) => item !== channel);
        return {
          ...current,
          channels: next.length > 0 ? next : current.channels,
        };
      }
      return { ...current, channels: [...current.channels, channel] };
    });
  };

  const saveEditingPolicy = () => {
    if (!editingPolicyId || !editingPolicyDraft) return;
    const normalizedName = editingPolicyDraft.name.trim();
    if (!normalizedName || editingPolicyDraft.channels.length === 0) return;
    updateSloRoutingPolicy.mutate(
      {
        id: editingPolicyId,
        patch: {
          name: normalizedName,
          breachType: editingPolicyDraft.breachType,
          severity: editingPolicyDraft.severity,
          channels: editingPolicyDraft.channels,
          priority: editingPolicyDraft.priority,
          isActive: editingPolicyDraft.isActive,
        },
      },
      {
        onSuccess: () => {
          setEditingPolicyId(null);
          setEditingPolicyDraft(null);
        },
      },
    );
  };

  const removePolicy = (policyId: number, policyName: string) => {
    if (!window.confirm(`Удалить policy "${policyName}"?`)) {
      return;
    }
    deleteSloRoutingPolicy.mutate(policyId, {
      onSuccess: () => {
        if (editingPolicyId === policyId) {
          setEditingPolicyId(null);
          setEditingPolicyDraft(null);
        }
      },
    });
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Операционный центр</h1>
      {isOpsAdmin ? (
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
            className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {runReminders.isPending ? "Запуск..." : "Запустить напоминания"}
          </button>
          <button
            onClick={() => runSloCheck.mutate(undefined)}
            disabled={runSloCheck.isPending}
            className="rounded-lg bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {runSloCheck.isPending ? "Проверка..." : "Запустить SLO-check"}
          </button>
          {runEscalations.data ? (
            <p className="text-sm text-gray-600">
              Обновлено задач: {runEscalations.data.updatedCount}, уведомлений SLA: задачи{" "}
              {runEscalations.data.taskEscalationNotifications}, документы{" "}
              {runEscalations.data.documentEscalationNotifications}, активных правил:{" "}
              {runEscalations.data.appliedPolicyCount}
            </p>
          ) : null}
          {runReminders.data ? (
            <p className="text-sm text-gray-600">
              Напоминания: задачи {runReminders.data.taskReminders}, LMS {runReminders.data.lmsReminders}
            </p>
          ) : null}
          {runSloCheck.data ? (
            <p className="text-sm text-gray-600">
              SLO-check: breach={runSloCheck.data.status.breaches.length}, alerted=
              {runSloCheck.data.alerted ? "yes" : "no"}, recipients={runSloCheck.data.recipients}, severity=
              {runSloCheck.data.severity ?? "n/a"}, channels={(runSloCheck.data.routedChannels ?? []).join(", ") || "n/a"}
            </p>
          ) : null}
        </div>
      ) : null}

      {isOpsAdmin ? (
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">SLO мониторинг</h2>
            <ShieldAlert className={`h-4 w-4 ${sloStatusQuery.data?.ok ? "text-green-600" : "text-red-600"}`} />
          </div>
          {sloStatusQuery.data ? (
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={sloStatusQuery.data.ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                  {sloStatusQuery.data.ok ? "SLO OK" : "SLO BREACH"}
                </Badge>
                <span className="text-gray-500">
                  окно {sloStatusQuery.data.windowMinutes} мин, обновлено {new Date(sloStatusQuery.data.generatedAt).toLocaleString()}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                <div className="rounded-lg border border-gray-200 p-2">
                  <p className="text-xs text-gray-500">API error rate</p>
                  <p className="font-semibold text-gray-900">
                    {sloStatusQuery.data.metrics.api.errorRatePercent}% / {sloStatusQuery.data.thresholds.apiErrorRatePercent}%
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 p-2">
                  <p className="text-xs text-gray-500">API p95 latency</p>
                  <p className="font-semibold text-gray-900">
                    {sloStatusQuery.data.metrics.api.p95LatencyMs}ms / {sloStatusQuery.data.thresholds.apiLatencyP95Ms}ms
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 p-2">
                  <p className="text-xs text-gray-500">Notification failure rate</p>
                  <p className="font-semibold text-gray-900">
                    {sloStatusQuery.data.metrics.notifications.failureRatePercent}% / {sloStatusQuery.data.thresholds.notificationFailureRatePercent}%
                  </p>
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 p-2">
                <p className="mb-1 text-xs text-gray-500">Последние SLO breach-события</p>
                <div className="space-y-1">
                  {(sloAuditQuery.data?.items ?? []).map((item) => {
                    const payload = item.payload as { status?: { breaches?: string[] } } | null;
                    const breaches = payload?.status?.breaches ?? [];
                    return (
                      <div key={item.id} className="flex items-center justify-between gap-2 rounded border border-gray-100 px-2 py-1">
                        <span className="truncate text-gray-700">
                          {breaches.length > 0 ? breaches.join(", ") : "no breach"}
                        </span>
                        <span className="text-xs text-gray-500">{new Date(item.createdAt).toLocaleString()}</span>
                      </div>
                    );
                  })}
                  {(sloAuditQuery.data?.items?.length ?? 0) === 0 ? (
                    <p className="text-xs text-gray-500">Нет записей о SLO-alert check.</p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Загрузка SLO-статуса...</p>
          )}
        </Card>
      ) : null}

      {isOpsAdmin ? (
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">SLO routing policies</h2>
            <span className="text-xs text-gray-500">База + fallback ENV</span>
          </div>
          <form onSubmit={onCreateRoutingPolicy} className="mb-4 grid grid-cols-1 gap-2 rounded-lg border border-gray-200 p-3 md:grid-cols-6">
            <input
              value={routingForm.name}
              onChange={(event) => setRoutingForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Policy name"
              className="rounded border border-gray-300 px-2 py-1 text-sm md:col-span-2"
            />
            <select
              value={routingForm.breachType}
              onChange={(event) =>
                setRoutingForm((current) => ({
                  ...current,
                  breachType: event.target.value as "any" | "api_error_rate" | "api_latency_p95" | "notification_failure_rate",
                }))
              }
              className="rounded border border-gray-300 px-2 py-1 text-sm"
            >
              <option value="any">any breach</option>
              <option value="api_error_rate">api_error_rate</option>
              <option value="api_latency_p95">api_latency_p95</option>
              <option value="notification_failure_rate">notification_failure_rate</option>
            </select>
            <select
              value={routingForm.severity}
              onChange={(event) =>
                setRoutingForm((current) => ({ ...current, severity: event.target.value as "any" | "warning" | "critical" }))
              }
              className="rounded border border-gray-300 px-2 py-1 text-sm"
            >
              <option value="any">any severity</option>
              <option value="warning">warning</option>
              <option value="critical">critical</option>
            </select>
            <input
              type="number"
              min={0}
              max={1000}
              value={routingForm.priority}
              onChange={(event) => setRoutingForm((current) => ({ ...current, priority: Number(event.target.value) || 0 }))}
              className="rounded border border-gray-300 px-2 py-1 text-sm"
            />
            <button
              type="submit"
              disabled={createSloRoutingPolicy.isPending}
              className="rounded bg-slate-800 px-3 py-1 text-sm font-medium text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {createSloRoutingPolicy.isPending ? "Создание..." : "Добавить"}
            </button>
            <div className="flex flex-wrap gap-3 md:col-span-6">
              {(["webhook", "email", "messenger"] as const).map((channel) => (
                <label key={channel} className="flex items-center gap-1 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={routingForm.channels.includes(channel)}
                    onChange={() => toggleRoutingChannel(channel)}
                  />
                  {channel}
                </label>
              ))}
            </div>
          </form>
          <div className="space-y-2">
            {(sloRoutingPoliciesQuery.data ?? []).map((policy) => {
              const isEditing = editingPolicyId === policy.id && editingPolicyDraft;
              return (
                <div key={policy.id} className="rounded-lg border border-gray-200 p-2 text-sm">
                  {isEditing ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-6">
                        <input
                          value={editingPolicyDraft.name}
                          onChange={(event) => setEditingPolicyDraft((current) => (current ? { ...current, name: event.target.value } : current))}
                          className="rounded border border-gray-300 px-2 py-1 text-sm md:col-span-2"
                        />
                        <select
                          value={editingPolicyDraft.breachType}
                          onChange={(event) =>
                            setEditingPolicyDraft((current) =>
                              current
                                ? {
                                    ...current,
                                    breachType: event.target.value as "any" | "api_error_rate" | "api_latency_p95" | "notification_failure_rate",
                                  }
                                : current,
                            )
                          }
                          className="rounded border border-gray-300 px-2 py-1 text-sm"
                        >
                          <option value="any">any breach</option>
                          <option value="api_error_rate">api_error_rate</option>
                          <option value="api_latency_p95">api_latency_p95</option>
                          <option value="notification_failure_rate">notification_failure_rate</option>
                        </select>
                        <select
                          value={editingPolicyDraft.severity}
                          onChange={(event) =>
                            setEditingPolicyDraft((current) =>
                              current ? { ...current, severity: event.target.value as "any" | "warning" | "critical" } : current,
                            )
                          }
                          className="rounded border border-gray-300 px-2 py-1 text-sm"
                        >
                          <option value="any">any severity</option>
                          <option value="warning">warning</option>
                          <option value="critical">critical</option>
                        </select>
                        <input
                          type="number"
                          min={0}
                          max={1000}
                          value={editingPolicyDraft.priority}
                          onChange={(event) =>
                            setEditingPolicyDraft((current) => (current ? { ...current, priority: Number(event.target.value) || 0 } : current))
                          }
                          className="rounded border border-gray-300 px-2 py-1 text-sm"
                        />
                        <label className="flex items-center gap-1 text-xs text-gray-700">
                          <input
                            type="checkbox"
                            checked={editingPolicyDraft.isActive}
                            onChange={(event) =>
                              setEditingPolicyDraft((current) => (current ? { ...current, isActive: event.target.checked } : current))
                            }
                          />
                          active
                        </label>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {(["webhook", "email", "messenger"] as const).map((channel) => (
                          <label key={channel} className="flex items-center gap-1 text-xs text-gray-700">
                            <input
                              type="checkbox"
                              checked={editingPolicyDraft.channels.includes(channel)}
                              onChange={() => toggleEditingChannel(channel)}
                            />
                            {channel}
                          </label>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={saveEditingPolicy}
                          disabled={updateSloRoutingPolicy.isPending}
                          className="rounded bg-slate-800 px-2 py-1 text-xs font-medium text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Сохранить
                        </button>
                        <button
                          onClick={() => {
                            setEditingPolicyId(null);
                            setEditingPolicyDraft(null);
                          }}
                          className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Отмена
                        </button>
                        <button
                          onClick={() => removePolicy(policy.id, policy.name)}
                          disabled={deleteSloRoutingPolicy.isPending}
                          className="rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Удалить
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900">
                          {policy.name}{" "}
                          <Badge className={policy.isActive ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}>
                            {policy.isActive ? "active" : "disabled"}
                          </Badge>
                        </p>
                        <p className="truncate text-xs text-gray-500">
                          breach={policy.breachType}, severity={policy.severity}, channels={policy.channels.join(", ")}, priority={policy.priority}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => startEditRoutingPolicy(policy)}
                          className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Редактировать
                        </button>
                        <button
                          onClick={() => removePolicy(policy.id, policy.name)}
                          disabled={deleteSloRoutingPolicy.isPending}
                          className="rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Удалить
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {(sloRoutingPoliciesQuery.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-gray-500">
                Политики не заданы — используется routing из ENV (`SLO_ALERT_CHANNELS_*`).
              </p>
            ) : null}
          </div>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Открытые задачи</p>
            <ListTodo className="h-4 w-4 text-teal-500" />
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
            <GraduationCap className="h-4 w-4 text-cyan-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-cyan-700">{overdueAssignments.length}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Задачи с ближайшим SLA (2 дня)</h2>
            <Link to="/tasks" className="text-xs text-teal-600 hover:text-teal-800">
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
            <Link to="/lms" className="text-xs text-teal-600 hover:text-teal-800">
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
                  <Badge className="bg-cyan-100 text-cyan-700">до {item.dueDate}</Badge>
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
            <Link to="/docs" className="text-xs text-teal-600 hover:text-teal-800">
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

