import { AlertTriangle, CheckCircle2, Circle, Clock } from "lucide-react";
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
import { priorityColors, statusColors, statusLabels, typeLabels } from "../lib/uiMaps";

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
      (task) => !statusFilter || task.status === statusFilter,
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
    selectedOfficeId ? u.officeId === selectedOfficeId : true,
  );

  const selectedEditOfficeId = editOfficeId ? Number(editOfficeId) : undefined;
  const editAssignees = data.users.filter((u) =>
    selectedEditOfficeId ? u.officeId === selectedEditOfficeId : true,
  );

  if (taskId) {
    const task = data.tasks.find((item) => item.id === Number(taskId));
    if (!task) {
      return <p className="text-sm text-gray-500">Задача не найдена.</p>;
    }

    const assignee = data.users.find((item) => item.id === task.assigneeId);
    const office = data.offices.find((item) => item.id === task.officeId);

    return (
      <div className="space-y-4">
        <Link to="/tasks" className="text-sm text-indigo-600 hover:text-indigo-800">
          ← Назад к списку
        </Link>

        <Card className="p-5 sm:p-6">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge className={statusColors[task.status]}>{statusLabels[task.status]}</Badge>
            <Badge className="bg-gray-100 text-gray-700">{typeLabels[task.type]}</Badge>
            <span className={priorityColors[task.priority]}>● {task.priority}</span>
          </div>

          {!editMode ? (
            <>
              <h2 className="mb-2 text-xl font-bold text-gray-900">{task.title}</h2>
              <p className="mb-4 text-gray-600">{task.description}</p>
              <div className="grid grid-cols-1 gap-2 text-sm text-gray-500 sm:grid-cols-2">
                <p>Исполнитель: {assignee?.name}</p>
                <p>Офис: {office?.name}</p>
                <p>Создано: {task.createdDate}</p>
                <p>Срок: {task.dueDate}</p>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <input
                value={editTitle}
                onChange={(event) => setEditTitle(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <textarea
                value={editDescription}
                onChange={(event) => setEditDescription(event.target.value)}
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <select
                  value={editOfficeId}
                  onChange={(event) => setEditOfficeId(event.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
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
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
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
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <select
                  value={editPriority}
                  onChange={(event) => setEditPriority(event.target.value as "low" | "medium" | "high")}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="low">Низкий</option>
                  <option value="medium">Средний</option>
                  <option value="high">Высокий</option>
                </select>
                <select
                  value={editType}
                  onChange={(event) => setEditType(event.target.value as "order" | "checklist" | "auto")}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="order">Поручение</option>
                  <option value="checklist">Чеклист</option>
                  <option value="auto">Автоматическая</option>
                </select>
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {(["new", "in_progress", "done", "overdue"] as const).map((status) => (
              <button
                key={status}
                onClick={() => updateTaskStatus.mutate({ id: task.id, status })}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                  task.status === status
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {statusLabels[status]}
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {canEdit && !editMode ? (
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
                className="rounded-lg bg-slate-700 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Редактировать
              </button>
            ) : null}

            {canEdit && editMode ? (
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
                  className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  Сохранить
                </button>
                <button
                  onClick={() => setEditMode(false)}
                  className="rounded-lg bg-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
                >
                  Отмена
                </button>
              </>
            ) : null}

            {canDelete ? (
              <button
                onClick={() => {
                  deleteTask.mutate(task.id, {
                    onSuccess: () => navigate("/tasks"),
                  });
                }}
                className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Удалить
              </button>
            ) : null}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Задачи</h1>

      <div className="flex flex-wrap gap-2">
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm"
        >
          <option value="">Все статусы</option>
          <option value="new">Новые</option>
          <option value="in_progress">В работе</option>
          <option value="done">Выполнены</option>
          <option value="overdue">Просрочены</option>
        </select>
      </div>

      {canCreate ? (
        <Card className="p-4">
          <h2 className="mb-3 font-semibold">Создать задачу</h2>
          <div className="space-y-2">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Название задачи"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              placeholder="Описание"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <select
                value={officeId}
                onChange={(event) => {
                  setOfficeId(event.target.value);
                  setAssigneeId("");
                }}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
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
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
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
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="low">Низкий</option>
                <option value="medium">Средний</option>
                <option value="high">Высокий</option>
              </select>
              <select
                value={type}
                onChange={(event) => setType(event.target.value as "order" | "checklist" | "auto")}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
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
              }}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Создать
            </button>
          </div>
        </Card>
      ) : null}

      <div className="space-y-2">
        {tasks.map((task) => {
          const assignee = data.users.find((item) => item.id === task.assigneeId);
          const office = data.offices.find((item) => item.id === task.officeId);
          return (
            <Card key={task.id} className="p-3 sm:p-4">
              <Link to={`/tasks/${task.id}`} className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  {task.status === "done" ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : task.status === "overdue" ? (
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                  ) : task.status === "in_progress" ? (
                    <Clock className="h-5 w-5 text-yellow-500" />
                  ) : (
                    <Circle className="h-5 w-5 text-blue-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 flex items-center gap-1.5">
                    <h3 className="text-sm font-medium text-gray-900">{task.title}</h3>
                    <span className={`text-xs ${priorityColors[task.priority]}`}>●</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <Badge className={statusColors[task.status]}>{statusLabels[task.status]}</Badge>
                    <Badge className="bg-gray-100 text-gray-600">{typeLabels[task.type]}</Badge>
                    <span>{assignee?.name}</span>
                    <span>•</span>
                    <span>{office?.name}</span>
                  </div>
                </div>
                <p className="shrink-0 text-xs text-gray-400">до {task.dueDate}</p>
              </Link>
            </Card>
          );
        })}
      </div>
    </div>
  );
}