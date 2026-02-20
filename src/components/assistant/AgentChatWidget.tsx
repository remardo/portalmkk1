import { Bot, Check, ClipboardCheck, MessageCircle, PlusCircle, Send, X } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/useAuth";
import {
  useCreateTaskMutation,
  usePortalData,
  useUpdateTaskMutation,
} from "../../hooks/usePortalData";
import { backendApi } from "../../services/apiClient";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type AgentAction =
  | {
      type: "create_task";
      title: string;
      description: string;
      priority: "low" | "medium" | "high";
      taskType: "order" | "checklist" | "auto";
      dueDate?: string | null;
      assigneeId?: string | null;
    }
  | {
      type: "complete_task";
      taskId?: number;
      taskTitle?: string;
    };

type PendingAction = AgentAction & {
  id: string;
  status: "pending" | "done" | "failed";
  resultMessage?: string;
};

function pageTitleByPath(pathname: string) {
  if (pathname === "/") return "Дашборд";
  if (pathname.startsWith("/tasks")) return "Задачи";
  if (pathname.startsWith("/lms")) return "Обучение";
  if (pathname.startsWith("/kb")) return "База знаний";
  if (pathname.startsWith("/docs")) return "Документы";
  if (pathname.startsWith("/reports")) return "Отчеты";
  if (pathname.startsWith("/org")) return "Оргструктура";
  if (pathname.startsWith("/ratings")) return "Рейтинги";
  if (pathname.startsWith("/shop")) return "Магазин";
  if (pathname.startsWith("/admin")) return "Админка";
  return "Раздел портала";
}

function renderInlineMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={`b-${idx}`} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <Fragment key={`t-${idx}`}>{part}</Fragment>;
  });
}

function MarkdownMessage({ text }: { text: string }) {
  const lines = text.split(/\r?\n/);
  return (
    <div className="space-y-1">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-2" />;
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          return (
            <div key={idx} className="ml-3 flex items-start gap-2">
              <span className="mt-1 text-[10px]">•</span>
              <span>{renderInlineMarkdown(trimmed.slice(2))}</span>
            </div>
          );
        }
        if (trimmed.startsWith("### ")) {
          return (
            <h4 key={idx} className="text-sm font-semibold">
              {renderInlineMarkdown(trimmed.slice(4))}
            </h4>
          );
        }
        return <p key={idx}>{renderInlineMarkdown(trimmed)}</p>;
      })}
    </div>
  );
}

function isoDatePlusDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function AgentChatWidget() {
  const { user } = useAuth();
  const { data } = usePortalData(Boolean(user));
  const createTask = useCreateTaskMutation();
  const updateTaskStatus = useUpdateTaskMutation();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Привет! Я ассистент портала. Пишу с поддержкой markdown и могу по вашей команде создать или закрыть задачу.",
    },
  ]);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [runningActionId, setRunningActionId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const page = useMemo(
    () => ({
      path: location.pathname,
      title: pageTitleByPath(location.pathname),
    }),
    [location.pathname],
  );

  const context = useMemo(() => {
    if (!user || !data) {
      return {
        pagePath: page.path,
        pageTitle: page.title,
      };
    }
    const myTasks = data.tasks.filter((task) => String(task.assigneeId) === String(user.id));
    const activeTasks = myTasks.filter((task) => task.status !== "done");
    const overdueTasks = myTasks.filter((task) => task.status === "overdue");
    const assignments = data.courseAssignments.filter((item) => String(item.userId) === String(user.id));
    const passedCourseIds = new Set(
      data.courseAttempts
        .filter((item) => String(item.userId) === String(user.id) && item.passed)
        .map((item) => Number(item.courseId)),
    );
    const assignedCourseIds = [...new Set(assignments.map((item) => Number(item.courseId)))];
    const nextCourses = assignedCourseIds
      .filter((id) => !passedCourseIds.has(id))
      .map((id) => data.courses.find((course) => Number(course.id) === id)?.title)
      .filter((title): title is string => Boolean(title))
      .slice(0, 5);

    return {
      pagePath: page.path,
      pageTitle: page.title,
      user: {
        id: String(user.id),
        name: user.name,
        role: user.role,
        officeId: user.officeId,
      },
      tasks: {
        total: myTasks.length,
        active: activeTasks.length,
        overdue: overdueTasks.length,
        top: activeTasks.slice(0, 10).map((task) => ({
          id: task.id,
          title: task.title,
          status: task.status,
          dueDate: task.dueDate,
          priority: task.priority,
        })),
      },
      lms: {
        assigned: assignedCourseIds.length,
        completed: assignedCourseIds.filter((id) => passedCourseIds.has(id)).length,
        nextCourses,
      },
      timestamp: new Date().toISOString(),
    };
  }, [data, page.path, page.title, user]);

  if (!user) {
    return null;
  }

  const handleSend = async () => {
    const question = input.trim();
    if (!question || loading) {
      return;
    }
    setError("");
    setInput("");
    setPendingActions([]);
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setLoading(true);
    try {
      const history = messages
        .filter((item) => item.role === "user" || item.role === "assistant")
        .slice(-10);
      const result = await backendApi.agentChat({
        question,
        page,
        context,
        history,
      });
      const sourceLine =
        result.sources.length > 0
          ? `\n\n**Источники:** ${result.sources.map((item) => item.title).slice(0, 3).join("; ")}`
          : "";
      setMessages((prev) => [...prev, { role: "assistant", content: `${result.answer}${sourceLine}` }]);
      if (result.actions.length > 0) {
        setPendingActions(
          result.actions.map((action, idx) => ({
            ...action,
            id: `${Date.now()}-${idx}`,
            status: "pending",
          })),
        );
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Не удалось получить ответ от агента";
      setError(message);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Не удалось ответить сейчас. Проверьте настройки OpenRouter и повторите запрос.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const executeAction = async (action: PendingAction) => {
    if (runningActionId || !data) {
      return;
    }
    const confirmed = window.confirm("Выполнить предложенное действие агента?");
    if (!confirmed) {
      return;
    }
    setRunningActionId(action.id);
    setError("");
    try {
      if (action.type === "create_task") {
        const assigneeId = action.assigneeId ?? String(user.id);
        const dueDate = action.dueDate ?? isoDatePlusDays(7);
        await createTask.mutateAsync({
          title: action.title,
          description: action.description,
          assigneeId,
          dueDate,
          priority: action.priority,
          type: action.taskType,
          officeId: user.officeId,
        });
        setPendingActions((prev) =>
          prev.map((item) =>
            item.id === action.id
              ? { ...item, status: "done", resultMessage: "Задача успешно создана." }
              : item,
          ),
        );
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Готово: создал задачу **${action.title}**.` },
        ]);
      } else {
        let taskId = action.taskId;
        if (!taskId && action.taskTitle) {
          const found = data.tasks.find(
            (task) =>
              String(task.assigneeId) === String(user.id) &&
              task.title.toLowerCase().includes(action.taskTitle!.toLowerCase()),
          );
          taskId = found?.id;
        }
        if (!taskId) {
          throw new Error("Не удалось определить задачу для закрытия. Уточните название или id.");
        }
        await updateTaskStatus.mutateAsync({ id: taskId, status: "done" });
        setPendingActions((prev) =>
          prev.map((item) =>
            item.id === action.id
              ? { ...item, status: "done", resultMessage: `Задача #${taskId} закрыта.` }
              : item,
          ),
        );
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Готово: закрыл задачу **#${taskId}**.` },
        ]);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Действие выполнить не удалось";
      setPendingActions((prev) =>
        prev.map((item) =>
          item.id === action.id ? { ...item, status: "failed", resultMessage: msg } : item,
        ),
      );
      setError(msg);
    } finally {
      setRunningActionId(null);
    }
  };

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-50">
      {open ? (
        <div className="pointer-events-auto flex h-[560px] w-[380px] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl shadow-gray-300/40">
          <div className="flex items-center justify-between border-b border-gray-100 bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              <p className="text-sm font-semibold">Агент портала</p>
            </div>
            <button onClick={() => setOpen(false)} className="rounded p-1 hover:bg-white/20">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto bg-gray-50 p-3">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`max-w-[92%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                  message.role === "user"
                    ? "ml-auto bg-indigo-600 text-white"
                    : "bg-white text-gray-700 shadow-sm"
                }`}
              >
                {message.role === "assistant" ? (
                  <MarkdownMessage text={message.content} />
                ) : (
                  message.content
                )}
              </div>
            ))}
            {loading && (
              <div className="max-w-[90%] rounded-xl bg-white px-3 py-2 text-sm text-gray-500 shadow-sm">
                Агент думает...
              </div>
            )}
          </div>

          {pendingActions.length > 0 && (
            <div className="border-t border-gray-100 bg-indigo-50/50 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-indigo-700">
                Предложенные действия
              </p>
              <div className="space-y-2">
                {pendingActions.map((action) => (
                  <div key={action.id} className="rounded-lg border border-indigo-100 bg-white p-2 text-xs">
                    {action.type === "create_task" ? (
                      <p className="text-gray-700">
                        <PlusCircle className="mr-1 inline h-3.5 w-3.5 text-indigo-600" />
                        Создать задачу: <span className="font-semibold">{action.title}</span>
                      </p>
                    ) : (
                      <p className="text-gray-700">
                        <ClipboardCheck className="mr-1 inline h-3.5 w-3.5 text-indigo-600" />
                        Закрыть задачу:{" "}
                        <span className="font-semibold">
                          {action.taskId ? `#${action.taskId}` : action.taskTitle ?? "без названия"}
                        </span>
                      </p>
                    )}
                    <div className="mt-2 flex items-center justify-between">
                      <span
                        className={`text-[11px] ${
                          action.status === "done"
                            ? "text-emerald-600"
                            : action.status === "failed"
                              ? "text-red-600"
                              : "text-gray-500"
                        }`}
                      >
                        {action.resultMessage ?? (action.status === "pending" ? "Ожидает подтверждения" : "")}
                      </span>
                      <button
                        disabled={action.status !== "pending" || runningActionId === action.id}
                        onClick={() => void executeAction(action)}
                        className="rounded bg-indigo-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {runningActionId === action.id ? "Выполнение..." : action.status === "done" ? (
                          <>
                            <Check className="mr-1 inline h-3 w-3" />
                            Выполнено
                          </>
                        ) : (
                          "Выполнить"
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-gray-100 bg-white p-3">
            {error ? <p className="mb-2 text-xs text-red-600">{error}</p> : null}
            <div className="flex items-end gap-2">
              <textarea
                rows={2}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder="Например: создай задачу обзвонить 5 клиентов и закрой задачу про принтер"
                className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
              <button
                onClick={() => void handleSend()}
                disabled={loading || !input.trim()}
                className="rounded-xl bg-indigo-600 p-2.5 text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-2xl shadow-indigo-400/40 transition-transform hover:scale-105"
          aria-label="Открыть чат агента"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}
    </div>
  );
}
