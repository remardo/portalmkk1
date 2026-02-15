import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  Circle,
  Clock,
  Filter,
  ListTodo,
  Plus,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { useAuth } from "../contexts/useAuth";
import {
  useCreateTaskMutation,
  useDeleteTaskMutation,
  useEditTaskMutation,
  usePortalData,
  useUpdateTaskMutation,
} from "../hooks/usePortalData";
import {
  canCreateTask,
  canDeleteTask,
  canEditTask,
  filterTasksForUser,
} from "../lib/permissions";
import { statusLabels, typeLabels } from "../lib/uiMaps";

const priorityConfig = {
  low: { color: "text-gray-400", bg: "bg-gray-100", label: "Низкий" },
  medium: { color: "text-amber-500", bg: "bg-amber-100", label: "Средний" },
  high: { color: "text-red-500", bg: "bg-red-100", label: "Высокий" },
};

const statusConfig = {
  new: { icon: Circle, color: "text-sky-500", bg: "bg-sky-100", label: "Новая" },
  in_progress: { icon: Clock, color: "text-amber-500", bg: "bg-amber-100", label: "В работе" },
  done: { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-100", label: "Выполнена" },
  overdue: { icon: AlertTriangle, color: "text-red-500", bg: "bg-red-100", label: "Просрочена" },
};

export function TasksPage() {
  const { data } = usePortalData();
  const { user } = useAuth();
  const updateTaskStatus = useUpdateTaskMutation();
  const editTask = useEditTaskMutation();
  const deleteTask = useDeleteTaskMutation();
  const createTask = useCreateTaskMutation();
  const navigate = useNavigate();

  const [taskId] = [useParams().taskId];
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("Новая задача");
  const [officeId, setOfficeId] = useState<string>("");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [type, setType] = useState<"order" | "checklist" | "auto">("order");

  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editOfficeId, setEditOfficeId] = useState<string>("");
  const [editAssigneeId, setEditAssigneeId] = useState<string>("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editPriority, setEditPriority] = useState<"low" | "medium" | "high">("medium");
  const [editType, setEditType] = useState<"order" | "checklist" | "auto">("order");

  const tasks = useMemo(() => {
    if (!data || !user) {
      return [];
    }
    return filterTasksForUser(data.tasks, user).filter(
      (task) => !statusFilter || task.status === statusFilter
    );
  }, [data, statusFilter, user]);

  if (!data || !user) {
    return null;
  }

  const canCreate = canCreateTask(user.role);
  const canEdit = canEditTask(user.role);
  const canDelete = canDeleteTask(user.role);

  const availableOffices =
    user.role === "office_head"
      ? data.offices.filter((office) => office.id === user.officeId)
      : data.offices;

  const selectedOfficeId = officeId ? Number(officeId) : availableOffices[0]?.id;
  const availableAssignees = data.users.filter((u) =>
    selectedOfficeId ? u.officeId === selectedOfficeId : true
  );

  const selectedEditOfficeId = editOfficeId ? Number(editOfficeId) : undefined;
  const editAssignees = data.users.filter((u) =>
    selectedEditOfficeId ? u.officeId === selectedEditOfficeId : true
  );

  // Task detail view
  if (taskId) {
    const task = data.tasks.find((item) => item.id === Number(taskId));
    if (!task) {
      return (
        <div className="flex h-64 items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <ListTodo className="h-6 w-6 text-red-600" />
            </div>
            <p className="text-sm text-gray-500">Задача не найдена.</p>
          </div>
        </div>
      );
    }

    const assignee = data.users.find((item) => item.id === task.assigneeId);
    const office = data.offices.find((item) => item.id === task.officeId);

    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Link
          to="/tasks"
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-indigo-600"
        >
          <ChevronLeft className="h-4 w-4" />
          Назад к списку
        </Link>

        <Card className="overflow-hidden">
          {/* Header */}
          <div className="border-b border-gray-100 bg-gray-50 px-6 py-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={
                  task.status === "done"
                    ? "success"
                    : task.status === "overdue"
                      ? "danger"
                      : task.status === "in_progress"
                        ? "warning"
                        : "info"
                }
              >
                {statusLabels[task.status]}
              </Badge>
              <Badge variant="default">{typeLabels[task.type]}</Badge>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${priorityConfig[task.priority].bg} ${priorityConfig[task.priority].color}`}
              >
                {priorityConfig[task.priority].label}
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {!editMode ? (
              <>
                <h2 className="text-xl font-bold text-gray-900">{task.title}</h2>
                <p className="mt-2 text-gray-600">{task.description}</p>

                <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div className="rounded-xl bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">Исполнитель</p>
                    <p className="mt-1 font-medium text-gray-900">{assignee?.name}</p>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">Офис</p>
                    <p className="mt-1 font-medium text-gray-900">{office?.name}</p>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">Создано</p>
                    <p className="mt-1 font-medium text-gray-900">{task.createdDate}</p>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">Срок</p>
                    <p className="mt-1 font-medium text-gray-900">{task.dueDate}</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <input
                  value={editTitle}
                  onChange={(event) => setEditTitle(event.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
                <textarea
                  value={editDescription}
                  onChange={(event) => setEditDescription(event.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={editOfficeId}
                    onChange={(event) => setEditOfficeId(event.target.value)}
                    className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  >
                    {availableOffices.map((officeItem) => (
                      <option key={officeItem.id} value={officeItem.id}>
                        {officeItem.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={editAssigneeId}
                    onChange={(event) => setEditAssigneeId(event.target.value)}
                    className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  >
                    {editAssignees.map((u) => (
                      <option key={String(u.id)} value={String(u.id)}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={editDueDate}
                    onChange={(event) => setEditDueDate(event.target.value)}
                    className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                  <select
                    value={editPriority}
                    onChange={(event) => setEditPriority(event.target.value as "low" | "medium" | "high")}
                    className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="low">Низкий</option>
                    <option value="medium">Средний</option>
                    <option value="high">Высокий</option>
                  </select>
                </div>
              </div>
            )}

            {/* Status buttons */}
            <div className="mt-6 flex flex-wrap gap-2">
              {(["new", "in_progress", "done", "overdue"] as const).map((status) => {
                const conf = statusConfig[status];
                const Icon = conf.icon;
                return (
                  <button
                    key={status}
                    onClick={() => updateTaskStatus.mutate({ id: task.id, status })}
                    className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                      task.status === status
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {conf.label}
                  </button>
                );
              })}
            </div>

            {/* Action buttons */}
            <div className="mt-6 flex flex-wrap gap-2">
              {canEdit && !editMode && (
                <button
                  onClick={() => {
                    setEditMode(true);
                    setEditTitle(task.title);
                    setEditDescription(task.description);
                    setEditOfficeId(String(task.officeId));
                    setEditAssigneeId(String(task.assigneeId));
                    setEditDueDate(task.dueDate);
                    setEditPriority(task.priority);
                    setEditType(task.type);
                  }}
                  className="rounded-xl bg-slate-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
                >
                  Редактировать
                </button>
              )}

              {canEdit && editMode && (
                <>
                  <button
                    onClick={() => {
                      editTask.mutate({
                        id: task.id,
                        title: editTitle,
                        description: editDescription,
                        officeId: Number(editOfficeId),
                        assigneeId: editAssigneeId,
                        dueDate: editDueDate,
                        priority: editPriority,
                        type: editType,
                      });
                      setEditMode(false);
                    }}
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
                  >
                    Сохранить
                  </button>
                  <button
                    onClick={() => setEditMode(false)}
                    className="rounded-xl bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-300"
                  >
                    Отмена
                  </button>
                </>
              )}

              {canDelete && (
                <button
                  onClick={() => {
                    deleteTask.mutate(task.id, {
                      onSuccess: () => navigate("/tasks"),
                    });
                  }}
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
                >
                  Удалить
                </button>
              )}
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Task list view
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Задачи</h1>
          <p className="mt-1 text-sm text-gray-500">Управление задачами и поручениями</p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
          >
            {showCreateForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showCreateForm ? "Отмена" : "Новая задача"}
          </button>
        )}
      </div>

      {/* Create form */}
      {canCreate && showCreateForm && (
        <Card className="overflow-hidden">
          <div className="border-b border-gray-100 bg-gray-50 px-5 py-4">
            <h2 className="font-semibold text-gray-900">Создать задачу</h2>
          </div>
          <div className="space-y-4 p-5">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Название задачи"
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              placeholder="Описание"
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <select
                value={officeId}
                onChange={(event) => {
                  setOfficeId(event.target.value);
                  setAssigneeId("");
                }}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              >
                {availableOffices.map((office) => (
                  <option key={office.id} value={office.id}>
                    {office.name}
                  </option>
                ))}
              </select>
              <select
                value={assigneeId}
                onChange={(event) => setAssigneeId(event.target.value)}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              >
                <option value="">Выберите ответственного</option>
                {availableAssignees.map((u) => (
                  <option key={String(u.id)} value={String(u.id)}>
                    {u.name}
                  </option>
                ))}
              </select>
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value as "low" | "medium" | "high")}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              >
                <option value="low">Низкий приоритет</option>
                <option value="medium">Средний приоритет</option>
                <option value="high">Высокий приоритет</option>
              </select>
              <select
                value={type}
                onChange={(event) => setType(event.target.value as "order" | "checklist" | "auto")}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              >
                <option value="order">Поручение</option>
                <option value="checklist">Чеклист</option>
                <option value="auto">Автоматическая</option>
              </select>
            </div>
            <button
              onClick={() => {
                if (!title.trim() || !assigneeId) {
                  return;
                }
                createTask.mutate({
                  title: title.trim(),
                  description: description.trim() || "Без описания",
                  assigneeId,
                  officeId: Number(officeId || availableOffices[0]?.id),
                  dueDate: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10),
                  priority,
                  type,
                });
                setTitle("");
                setDescription("Новая задача");
                setShowCreateForm(false);
              }}
              className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
            >
              Создать задачу
            </button>
          </div>
        </Card>
      )}

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-gray-400" />
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        >
          <option value="">Все статусы</option>
          <option value="new">Новые</option>
          <option value="in_progress">В работе</option>
          <option value="done">Выполнены</option>
          <option value="overdue">Просрочены</option>
        </select>
      </div>

      {/* Task list */}
      <div className="space-y-3">
        {tasks.map((task) => {
          const assignee = data.users.find((item) => item.id === task.assigneeId);
          const office = data.offices.find((item) => item.id === task.officeId);
          const statusConf = statusConfig[task.status];
          const Icon = statusConf.icon;

          return (
            <Link key={task.id} to={`/tasks/${task.id}`}>
              <Card hover className="p-4">
                <div className="flex items-start gap-4">
                  <div
                    className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${statusConf.bg}`}
                  >
                    <Icon className={`h-5 w-5 ${statusConf.color}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900">{task.title}</h3>
                      <span
                        className={`h-2 w-2 rounded-full ${
                          task.priority === "high"
                            ? "bg-red-400"
                            : task.priority === "medium"
                              ? "bg-amber-400"
                              : "bg-gray-300"
                        }`}
                      />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      <Badge
                        variant={
                          task.status === "done"
                            ? "success"
                            : task.status === "overdue"
                              ? "danger"
                              : "info"
                        }
                      >
                        {statusLabels[task.status]}
                      </Badge>
                      <Badge variant="default">{typeLabels[task.type]}</Badge>
                      <span>{assignee?.name}</span>
                      <span className="text-gray-300">•</span>
                      <span>{office?.name}</span>
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-xs text-gray-400">до</p>
                    <p className="text-sm font-medium text-gray-600">{task.dueDate}</p>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}

        {tasks.length === 0 && (
          <Card className="p-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
              <ListTodo className="h-6 w-6 text-gray-400" />
            </div>
            <p className="text-gray-500">Задач не найдено</p>
          </Card>
        )}
      </div>
    </div>
  );
}
