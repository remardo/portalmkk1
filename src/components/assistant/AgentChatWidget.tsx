import { Bot, MessageCircle, Send, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/useAuth";
import { usePortalData } from "../../hooks/usePortalData";
import { backendApi } from "../../services/apiClient";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
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

export function AgentChatWidget() {
  const { user } = useAuth();
  const { data } = usePortalData(Boolean(user));
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Привет! Я ассистент портала. Задайте вопрос по текущей странице, задачам или обучению.",
    },
  ]);
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

    const routeItems =
      location.pathname.startsWith("/tasks")
        ? activeTasks.slice(0, 5).map((task) => task.title)
        : location.pathname.startsWith("/lms")
          ? nextCourses
          : location.pathname.startsWith("/kb")
            ? data.kbArticles.slice(0, 5).map((item) => item.title)
            : [];

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
        top: activeTasks.slice(0, 5).map((task) => ({
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
      currentPageItems: routeItems,
      timestamp: new Date().toISOString(),
    };
  }, [data, location.pathname, page.path, page.title, user]);

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
          ? `\n\nИсточники: ${result.sources.map((item) => item.title).slice(0, 3).join("; ")}`
          : "";
      setMessages((prev) => [...prev, { role: "assistant", content: `${result.answer}${sourceLine}` }]);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Не удалось получить ответ от агента";
      setError(message);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Не удалось ответить сейчас. Проверьте настройки OpenRouter и повторите." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-50">
      {open ? (
        <div className="pointer-events-auto flex h-[520px] w-[360px] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl shadow-gray-300/40">
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
                className={`max-w-[90%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                  message.role === "user"
                    ? "ml-auto bg-indigo-600 text-white"
                    : "bg-white text-gray-700 shadow-sm"
                }`}
              >
                {message.content}
              </div>
            ))}
            {loading && (
              <div className="max-w-[90%] rounded-xl bg-white px-3 py-2 text-sm text-gray-500 shadow-sm">
                Агент думает...
              </div>
            )}
          </div>

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
                placeholder="Спросите про задачи, обучение или действия на текущей странице..."
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
