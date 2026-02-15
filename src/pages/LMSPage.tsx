import { useQuery } from "@tanstack/react-query";
import { Award } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { useAuth } from "../contexts/useAuth";
import { usePortalData } from "../hooks/usePortalData";
import { canManageLMS } from "../lib/permissions";
import { backendApi } from "../services/apiClient";

function MarkdownPreview({ markdown }: { markdown: string }) {
  const lines = markdown.split(/\r?\n/);
  return (
    <div className="space-y-2 text-sm text-gray-800">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-2" />;
        if (trimmed.startsWith("### ")) return <h4 key={idx} className="font-semibold">{trimmed.slice(4)}</h4>;
        if (trimmed.startsWith("## ")) return <h3 key={idx} className="text-base font-semibold">{trimmed.slice(3)}</h3>;
        if (trimmed.startsWith("# ")) return <h2 key={idx} className="text-lg font-bold">{trimmed.slice(2)}</h2>;
        if (trimmed.startsWith("- ")) return <li key={idx} className="ml-4 list-disc">{trimmed.slice(2)}</li>;
        return <p key={idx}>{trimmed}</p>;
      })}
    </div>
  );
}

export function LMSPage() {
  const { data } = usePortalData();
  const { userId, courseId: courseIdParam } = useParams();
  const { user } = useAuth();

  const canManage = user ? canManageLMS(user.role) : false;

  const lmsCoursesQuery = useQuery({
    queryKey: ["lms-courses", canManage],
    queryFn: () => backendApi.getLmsBuilderCourses(canManage),
    enabled: true,
  });

  const courseId = courseIdParam ? Number(courseIdParam) : undefined;

  const lmsCourseQuery = useQuery({
    queryKey: ["lms-course", courseId],
    queryFn: () => backendApi.getLmsBuilderCourse(Number(courseId)),
    enabled: Boolean(courseId && !Number.isNaN(courseId)),
  });

  if (!data) {
    return null;
  }

  const legacyPublishedCourses = data.courses
    .filter((course) => (course.status ?? "published") === "published")
    .map((course) => ({
      id: course.id,
      title: course.title,
      description: course.category,
      status: (course.status ?? "published") as "draft" | "published" | "archived",
    }));

  const visibleCourses = lmsCoursesQuery.data && lmsCoursesQuery.data.length > 0
    ? lmsCoursesQuery.data
    : legacyPublishedCourses;

  if (courseId !== undefined && !Number.isNaN(courseId)) {
    if (lmsCourseQuery.isLoading) {
      return <p className="text-sm text-gray-500">Загрузка курса...</p>;
    }

    if (lmsCourseQuery.isError || !lmsCourseQuery.data) {
      return <p className="text-sm text-gray-500">Курс не найден.</p>;
    }

    const course = lmsCourseQuery.data;

    return (
      <div className="space-y-4">
        <Link to="/lms" className="text-sm text-indigo-600 hover:text-indigo-800">
          ← Назад к LMS
        </Link>

        <Card className="p-5">
          <Badge className="mb-2 bg-purple-100 text-purple-700">{course.status}</Badge>
          <h2 className="text-xl font-bold text-gray-900">{course.title}</h2>
          {course.description ? <p className="mt-1 text-sm text-gray-500">{course.description}</p> : null}
        </Card>

        {(course.sections ?? []).map((section) => (
          <Card key={section.id} className="space-y-3 p-5">
            <h3 className="text-lg font-semibold text-gray-900">
              {section.sort_order}. {section.title}
            </h3>

            {(section.subsections ?? []).map((subsection) => (
              <div key={subsection.id} className="rounded-lg border border-gray-200 p-4">
                <h4 className="mb-2 font-semibold text-gray-900">
                  {subsection.sort_order}. {subsection.title}
                </h4>

                <MarkdownPreview markdown={subsection.markdown_content ?? ""} />

                <div className="mt-3 space-y-2">
                  {(subsection.media ?? []).map((item) => (
                    <div key={item.id} className="rounded border border-gray-200 p-2">
                      {item.media_type === "image" && item.image_data_base64 ? (
                        <img
                          src={`data:${item.image_mime_type ?? "image/png"};base64,${item.image_data_base64}`}
                          alt={item.caption ?? "image"}
                          className="max-h-80 w-auto rounded"
                        />
                      ) : null}
                      {item.media_type === "video" && item.external_url ? (
                        <a href={item.external_url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
                          {item.external_url}
                        </a>
                      ) : null}
                      {item.caption ? <p className="mt-1 text-sm text-gray-500">{item.caption}</p> : null}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </Card>
        ))}

        {(course.sections ?? []).length === 0 ? (
          <Card className="p-5 text-sm text-gray-500">В курсе пока нет разделов и уроков.</Card>
        ) : null}
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
            <h4 className="text-sm font-semibold text-gray-700">Попытки (детально)</h4>
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

      {lmsCoursesQuery.isLoading ? <p className="text-sm text-gray-500">Загрузка курсов...</p> : null}
      {lmsCoursesQuery.isError ? (
        <p className="text-sm text-red-600">Не удалось загрузить курсы: {(lmsCoursesQuery.error as Error).message}</p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {visibleCourses.map((course) => (
          <Card key={course.id} className="p-4">
            <Badge className="mb-2 bg-purple-100 text-purple-700">{course.status}</Badge>
            <h3 className="font-semibold text-gray-900">{course.title}</h3>
            <p className="mt-2 text-xs text-gray-500">{course.description ?? "Описание не заполнено"}</p>
            <div className="mt-3">
              <Link
                to={`/lms/courses/${course.id}`}
                className="inline-flex rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
              >
                Открыть курс
              </Link>
            </div>
          </Card>
        ))}
      </div>

      {!lmsCoursesQuery.isLoading && !lmsCoursesQuery.isError && visibleCourses.length === 0 ? (
        <Card className="p-4 text-sm text-gray-500">Курсы пока не опубликованы.</Card>
      ) : null}

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
