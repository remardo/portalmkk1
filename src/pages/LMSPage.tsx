import { Award } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import {
  useAssignCourseMutation,
  useCreateCourseAttemptMutation,
  useCreateCourseMutation,
  usePortalData,
  useUpdateCourseMutation,
} from "../hooks/usePortalData";
import { useAuth } from "../contexts/useAuth";
import { canManageLMS } from "../lib/permissions";
import { useMemo, useState } from "react";

export function LMSPage() {
  const { data } = usePortalData();
  const [userId] = [useParams().userId];
  const { user } = useAuth();

  const createCourse = useCreateCourseMutation();
  const updateCourse = useUpdateCourseMutation();
  const assignCourse = useAssignCourseMutation();
  const createCourseAttempt = useCreateCourseAttemptMutation();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Базовый");
  const [questionsCount, setQuestionsCount] = useState("10");
  const [passingScore, setPassingScore] = useState("80");

  const [assignCourseId, setAssignCourseId] = useState<number | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  const [editingCourseId, setEditingCourseId] = useState<number | null>(null);
  const [editCourseTitle, setEditCourseTitle] = useState("");
  const [editCourseCategory, setEditCourseCategory] = useState("");
  const [attemptCourseId, setAttemptCourseId] = useState<string>("");
  const [attemptScore, setAttemptScore] = useState<string>("80");

  const assignmentMap = useMemo(() => {
    if (!data) {
      return new Map<number, string[]>();
    }
    const map = new Map<number, string[]>();
    data.courseAssignments.forEach((item) => {
      const current = map.get(item.courseId) ?? [];
      current.push(item.userId);
      map.set(item.courseId, current);
    });
    return map;
  }, [data]);

  if (!data) {
    return null;
  }

  const canManage = user ? canManageLMS(user.role) : false;

  if (userId) {
    const employee = data.users.find((item) => String(item.id) === userId);
    if (!employee) {
      return <p className="text-sm text-gray-500">Сотрудник не найден.</p>;
    }
    const employeeAtts = data.attestations
      .filter((item) => item.userId === employee.id)
      .sort((a, b) => b.date.localeCompare(a.date));
    const employeeAttempts = data.courseAttempts
      .filter((item) => item.userId === employee.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return (
      <div className="space-y-4">
        <Link to="/lms" className="text-sm text-indigo-600 hover:text-indigo-800">
          ← Назад
        </Link>
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-3">
            <span className="text-3xl">{employee.avatar}</span>
            <div>
              <h2 className="text-lg font-bold">{employee.name}</h2>
              <p className="text-sm text-gray-500">{employee.position}</p>
              <div className="mt-1 flex items-center gap-1">
                <Award className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-semibold">{employee.points} баллов</span>
              </div>
            </div>
          </div>
          <h3 className="mb-2 font-semibold">История аттестаций</h3>
          <div className="space-y-2">
            {employeeAtts.map((attestation) => {
              const course = data.courses.find((item) => item.id === attestation.courseId);
              return (
                <div key={attestation.id} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                  <div>
                    <p className="font-medium">{course?.title}</p>
                    <p className="text-xs text-gray-400">{attestation.date}</p>
                  </div>
                  <Badge className={attestation.passed ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                    {attestation.score}%
                  </Badge>
                </div>
              );
            })}
          </div>

          {canManage ? (
            <div className="mt-4 space-y-2 rounded-lg border border-gray-200 p-3">
              <h4 className="text-sm font-semibold">Добавить попытку</h4>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <select
                  value={attemptCourseId}
                  onChange={(event) => setAttemptCourseId(event.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">Выберите курс</option>
                  {data.courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={attemptScore}
                  onChange={(event) => setAttemptScore(event.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <button
                onClick={() => {
                  if (!attemptCourseId) return;
                  createCourseAttempt.mutate({
                    courseId: Number(attemptCourseId),
                    score: Number(attemptScore || 0),
                    userId: String(employee.id),
                  });
                }}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Добавить попытку
              </button>
            </div>
          ) : null}

          <div className="mt-4 space-y-1 text-xs text-gray-500">
            <h4 className="font-semibold text-sm text-gray-700">Попытки (детально)</h4>
            {employeeAttempts.length === 0 ? (
              <p>Пока нет попыток</p>
            ) : (
              employeeAttempts.map((attempt) => {
                const course = data.courses.find((c) => c.id === attempt.courseId);
                return (
                  <p key={attempt.id}>
                    {new Date(attempt.createdAt).toLocaleString()} • {course?.title} • {attempt.score}% • попытка #{attempt.attemptNo}
                  </p>
                );
              })
            )}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Обучение (LMS)</h1>

      {canManage ? (
        <Card className="p-4">
          <h2 className="mb-3 font-semibold">Создать курс</h2>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Название"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              placeholder="Категория"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              value={questionsCount}
              onChange={(event) => setQuestionsCount(event.target.value)}
              placeholder="Вопросов"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              value={passingScore}
              onChange={(event) => setPassingScore(event.target.value)}
              placeholder="Порог %"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={() => {
              if (!title.trim()) return;
              createCourse.mutate({
                title: title.trim(),
                category: category.trim() || "Общее",
                questionsCount: Number(questionsCount || 10),
                passingScore: Number(passingScore || 80),
                status: "draft",
              });
              setTitle("");
            }}
            className="mt-3 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Создать
          </button>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {data.courses.map((course) => {
          const attempts = data.attestations.filter((item) => item.courseId === course.id);
          const passed = attempts.filter((item) => item.passed).length;
          const assignedCount = assignmentMap.get(course.id)?.length ?? 0;
          const isEditing = editingCourseId === course.id;
          const courseUsers = data.users.filter((u) => u.role !== "admin");
          const isAssigning = assignCourseId === course.id;

          return (
            <Card key={course.id} className="p-4">
              <Badge className="mb-2 bg-purple-100 text-purple-700">{course.category}</Badge>
              {!isEditing ? (
                <h3 className="font-semibold text-gray-900">{course.title}</h3>
              ) : (
                <div className="space-y-2">
                  <input
                    value={editCourseTitle}
                    onChange={(event) => setEditCourseTitle(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                  <input
                    value={editCourseCategory}
                    onChange={(event) => setEditCourseCategory(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
              )}
              <p className="mt-2 text-xs text-gray-500">
                {course.questionsCount} вопросов • Порог {course.passingScore}% • Сдали {passed}/{attempts.length}
              </p>
              <p className="mt-1 text-xs text-gray-500">Назначено: {assignedCount}</p>
              <p className="mt-1 text-xs text-gray-500">Статус: {course.status ?? "published"}</p>

              {canManage ? (
                <div className="mt-3 space-y-2">
                  {!isEditing ? (
                    <button
                      onClick={() => {
                        setEditingCourseId(course.id);
                        setEditCourseTitle(course.title);
                        setEditCourseCategory(course.category);
                      }}
                      className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                    >
                      Редактировать курс
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          updateCourse.mutate({
                            id: course.id,
                            title: editCourseTitle,
                            category: editCourseCategory,
                          });
                          setEditingCourseId(null);
                        }}
                        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                      >
                        Сохранить
                      </button>
                      <button
                        onClick={() => setEditingCourseId(null)}
                        className="rounded-lg bg-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-300"
                      >
                        Отмена
                      </button>
                    </div>
                  )}

                  {!isAssigning ? (
                    <button
                      onClick={() => {
                        setAssignCourseId(course.id);
                        setSelectedUsers([]);
                      }}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                    >
                      Назначить курс
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <div className="max-h-36 overflow-auto rounded-lg border border-gray-200 p-2">
                        {courseUsers.map((u) => {
                          const checked = selectedUsers.includes(String(u.id));
                          return (
                            <label key={String(u.id)} className="flex items-center gap-2 py-0.5 text-xs">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(event) => {
                                  setSelectedUsers((prev) => {
                                    if (event.target.checked) return [...prev, String(u.id)];
                                    return prev.filter((id) => id !== String(u.id));
                                  });
                                }}
                              />
                              <span>{u.name}</span>
                            </label>
                          );
                        })}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            if (selectedUsers.length === 0) return;
                            assignCourse.mutate({ courseId: course.id, userIds: selectedUsers });
                            setAssignCourseId(null);
                          }}
                          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                        >
                          Сохранить назначения
                        </button>
                        <button
                          onClick={() => setAssignCourseId(null)}
                          className="rounded-lg bg-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-300"
                        >
                          Отмена
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>

      <Card className="p-4">
        <h2 className="mb-3 font-semibold">Сотрудники</h2>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {data.users
            .filter((item) => item.role !== "admin")
            .map((employee) => (
              <Link
                key={String(employee.id)}
                to={`/lms/users/${employee.id}`}
                className="rounded-lg border border-gray-200 p-2 text-sm transition hover:border-indigo-300 hover:bg-indigo-50"
              >
                <span className="mr-2">{employee.avatar}</span>
                {employee.name}
              </Link>
            ))}
        </div>
      </Card>
    </div>
  );
}
