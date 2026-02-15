import { Award } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import {
  useCourseQuestionsQuery,
  usePortalData,
  useSubmitCourseAnswersMutation,
} from "../hooks/usePortalData";
import { useAuth } from "../contexts/useAuth";
import { canManageLMS } from "../lib/permissions";
import { useMemo, useState } from "react";

export function LMSPage() {
  const { data } = usePortalData();
  const { userId, courseId: courseIdParam } = useParams();
  const { user } = useAuth();

  const submitCourseAnswers = useSubmitCourseAnswersMutation();

  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [submitError, setSubmitError] = useState<string>("");
  const [submitInfo, setSubmitInfo] = useState<string>("");

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

  const courseId = courseIdParam ? Number(courseIdParam) : undefined;
  const courseQuestionsQuery = useCourseQuestionsQuery(Number.isNaN(courseId ?? NaN) ? undefined : courseId);

  if (!data) {
    return null;
  }

  const canManage = user ? canManageLMS(user.role) : false;

  if (courseId !== undefined && !Number.isNaN(courseId)) {
    const course = data.courses.find((item) => item.id === courseId);
    if (!course) {
      return <p className="text-sm text-gray-500">Курс не найден.</p>;
    }

    const canOpenCourse = course.status === "published" || canManage;
    if (!canOpenCourse) {
      return <p className="text-sm text-gray-500">Курс недоступен для прохождения.</p>;
    }

    const answeredCount = Object.keys(selectedAnswers).length;

    return (
      <div className="space-y-4">
        <Link to="/lms" className="text-sm text-indigo-600 hover:text-indigo-800">
          ← Назад к LMS
        </Link>

        <Card className="p-5">
          <Badge className="mb-2 bg-purple-100 text-purple-700">{course.category}</Badge>
          <h2 className="text-xl font-bold text-gray-900">{course.title}</h2>
          <p className="mt-1 text-sm text-gray-500">
            Вопросов: {course.questionsCount} • Порог: {course.passingScore}% • Статус: {course.status ?? "published"}
          </p>
        </Card>

        <Card className="p-5">
          {courseQuestionsQuery.isLoading ? <p className="text-sm text-gray-500">Загрузка вопросов…</p> : null}
          {courseQuestionsQuery.isError ? (
            <p className="text-sm text-red-600">Не удалось загрузить вопросы курса.</p>
          ) : null}

          {courseQuestionsQuery.data ? (
            <div className="space-y-4">
              {courseQuestionsQuery.data.items.map((item) => (
                <div key={item.id} className="rounded-lg border border-gray-200 p-3">
                  <p className="font-medium text-gray-900">
                    {item.sortOrder}. {item.question}
                  </p>
                  <div className="mt-2 space-y-1">
                    {item.options.map((option, idx) => (
                      <label key={`${item.id}-${idx}`} className="flex items-start gap-2 text-sm text-gray-700">
                        <input
                          type="radio"
                          name={`q-${item.id}`}
                          checked={selectedAnswers[item.id] === idx}
                          onChange={() =>
                            setSelectedAnswers((prev) => ({
                              ...prev,
                              [item.id]: idx,
                            }))
                          }
                        />
                        <span>{option}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}

              <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-sm text-indigo-900">
                Отвечено: {answeredCount} из {courseQuestionsQuery.data.items.length}
              </div>

              {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}
              {submitInfo ? <p className="text-sm text-green-700">{submitInfo}</p> : null}

              <button
                disabled={submitCourseAnswers.isPending}
                onClick={async () => {
                  setSubmitError("");
                  setSubmitInfo("");

                  const questions = courseQuestionsQuery.data?.items ?? [];
                  if (questions.length === 0) {
                    setSubmitError("В курсе пока нет вопросов.");
                    return;
                  }

                  if (Object.keys(selectedAnswers).length < questions.length) {
                    setSubmitError("Ответьте на все вопросы перед отправкой.");
                    return;
                  }

                  try {
                    const response = await submitCourseAnswers.mutateAsync({
                      courseId: course.id,
                      answers: questions.map((q) => ({
                        questionId: q.id,
                        selectedOption: selectedAnswers[q.id],
                      })),
                    });
                    setSubmitInfo(
                      `Результат: ${response.score}% (${response.correct}/${response.total}). Попытка #${response.attemptNo} сохранена.`,
                    );
                  } catch {
                    setSubmitError("Не удалось отправить попытку. Попробуйте еще раз.");
                  }
                }}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {submitCourseAnswers.isPending ? "Отправка..." : "Завершить тест"}
              </button>
            </div>
          ) : null}
        </Card>
      </div>
    );
  }

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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {data.courses.map((course) => {
          const attempts = data.attestations.filter((item) => item.courseId === course.id);
          const passed = attempts.filter((item) => item.passed).length;
          const assignedCount = assignmentMap.get(course.id)?.length ?? 0;

          return (
            <Card key={course.id} className="p-4">
              <Badge className="mb-2 bg-purple-100 text-purple-700">{course.category}</Badge>
              <h3 className="font-semibold text-gray-900">{course.title}</h3>
              <p className="mt-2 text-xs text-gray-500">
                {course.questionsCount} вопросов • Порог {course.passingScore}% • Сдали {passed}/{attempts.length}
              </p>
              <p className="mt-1 text-xs text-gray-500">Назначено: {assignedCount}</p>
              <p className="mt-1 text-xs text-gray-500">Статус: {course.status ?? "published"}</p>
              {course.status === "published" || canManage ? (
                <div className="mt-3">
                  <Link
                    to={`/lms/courses/${course.id}`}
                    className="inline-flex rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                  >
                    Пройти курс
                  </Link>
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
