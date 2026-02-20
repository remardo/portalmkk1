import { useQuery } from "@tanstack/react-query";
import { Award, BookOpen, ChevronLeft, ChevronRight, Clock, Users, CheckCircle } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { useAuth } from "../contexts/useAuth";
import { usePortalData } from "../hooks/usePortalData";
import { canManageLMS } from "../lib/permissions";
import { backendApi } from "../services/apiClient";

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

  const courseProgressQuery = useQuery({
    queryKey: ["lms-progress", courseId],
    queryFn: () => backendApi.getLmsCourseProgress(Number(courseId)),
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

  const visibleCourses =
    lmsCoursesQuery.data && lmsCoursesQuery.data.length > 0
      ? lmsCoursesQuery.data
      : legacyPublishedCourses;

  // Course detail view
  if (courseId !== undefined && !Number.isNaN(courseId)) {
    if (lmsCourseQuery.isLoading) {
      return (
        <div className="flex h-64 items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-teal-200 border-t-teal-600" />
            <p className="text-sm text-gray-500">Загрузка курса...</p>
          </div>
        </div>
      );
    }

    if (lmsCourseQuery.isError || !lmsCourseQuery.data) {
      return (
        <div className="flex h-64 items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <BookOpen className="h-6 w-6 text-red-600" />
            </div>
            <p className="text-sm text-gray-500">Курс не найден.</p>
          </div>
        </div>
      );
    }

    const course = lmsCourseQuery.data;

    // Calculate total lessons
    const totalLessons = (course.sections ?? []).reduce(
      (acc, section) => acc + (section.subsections ?? []).length,
      0
    );

    // Calculate completed lessons
    const completedLessons = courseProgressQuery.data?.completedSubsections ?? 0;
    const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

    return (
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Back link */}
        <Link
          to="/lms"
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-teal-600"
        >
          <ChevronLeft className="h-4 w-4" />
          Назад к курсам
        </Link>

        {/* Course header */}
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-teal-500 to-cyan-600 p-6 text-white">
            <Badge variant="cyan" className="mb-3 bg-white/20 text-white">
              {course.status === "published" ? "Опубликован" : course.status}
            </Badge>
            <h1 className="text-2xl font-bold">{course.title}</h1>
            {course.description && <p className="mt-2 text-teal-100">{course.description}</p>}
            
            {/* Progress bar */}
            {totalLessons > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm text-teal-100">
                  <span>Прогресс курса</span>
                  <span>{completedLessons} из {totalLessons} уроков ({progressPercent}%)</span>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-white/20">
                  <div
                    className="h-2 rounded-full bg-white transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Course sections with clickable lessons */}
        {(course.sections ?? []).map((section, sectionIndex) => {
          // Calculate section progress
          const sectionCompleted = courseProgressQuery.data?.sections
            .find((s) => s.sectionId === section.id)?.completedSubsections ?? 0;
          const sectionTotal = section.subsections?.length ?? 0;
          const sectionProgress = sectionTotal > 0 ? Math.round((sectionCompleted / sectionTotal) * 100) : 0;

          return (
            <Card key={section.id} className="overflow-hidden">
              <div className="border-b border-gray-100 bg-gray-50 px-5 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-100 text-sm font-bold text-teal-600">
                      {section.sort_order || sectionIndex + 1}
                    </div>
                    <h2 className="text-lg font-semibold text-gray-900">{section.title}</h2>
                  </div>
                  {sectionTotal > 0 && (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span>{sectionCompleted}/{sectionTotal}</span>
                      <div className="h-2 w-16 rounded-full bg-gray-200">
                        <div
                          className="h-2 rounded-full bg-teal-600"
                          style={{ width: `${sectionProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="divide-y divide-gray-50">
                {(section.subsections ?? []).map((subsection, subIndex) => {
                  // Check if this lesson is completed
                  const isCompleted = courseProgressQuery.data?.sections
                    .find((s) => s.sectionId === section.id)
                    ?.subsections.find((sub) => sub.subsectionId === subsection.id)?.completed ?? false;

                  return (
                    <Link
                      key={subsection.id}
                      to={`/lms/courses/${courseId}/lessons/${subsection.id}`}
                      className="flex items-center gap-4 p-4 transition-colors hover:bg-teal-50"
                    >
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                        isCompleted 
                          ? "bg-green-100 text-green-600" 
                          : "bg-gray-100 text-gray-600"
                      } text-sm font-medium`}>
                        {isCompleted ? (
                          <CheckCircle className="h-4 w-4" />
                        ) : (
                          subsection.sort_order || subIndex + 1
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{subsection.title}</p>
                        <p className="text-xs text-gray-500 line-clamp-1">
                          {subsection.markdown_content?.slice(0, 100) || "Нет описания"}
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    </Link>
                  );
                })}
              </div>
            </Card>
          );
        })}

        {(course.sections ?? []).length === 0 && (
          <Card className="p-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
              <BookOpen className="h-6 w-6 text-gray-400" />
            </div>
            <p className="text-gray-500">В курсе пока нет разделов и уроков.</p>
          </Card>
        )}
      </div>
    );
  }

  // User profile view
  if (userId) {
    const employee = data.users.find((item) => String(item.id) === userId);
    if (!employee) {
      return (
        <div className="flex h-64 items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <Users className="h-6 w-6 text-red-600" />
            </div>
            <p className="text-sm text-gray-500">Сотрудник не найден.</p>
          </div>
        </div>
      );
    }
    const employeeAtts = data.attestations
      .filter((item) => item.userId === employee.id)
      .sort((a, b) => b.date.localeCompare(a.date));
    const employeeAttempts = data.courseAttempts
      .filter((item) => item.userId === employee.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Link
          to="/lms"
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-teal-600"
        >
          <ChevronLeft className="h-4 w-4" />
          Назад
        </Link>

        <Card className="overflow-hidden">
          {/* User header */}
          <div className="bg-gradient-to-r from-teal-500 to-cyan-600 p-6 text-white">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 text-3xl backdrop-blur-sm">
                {employee.avatar}
              </div>
              <div>
                <h2 className="text-xl font-bold">{employee.name}</h2>
                <p className="text-teal-100">{employee.position}</p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex items-center gap-1 rounded-full bg-white/20 px-3 py-1">
                    <Award className="h-4 w-4" />
                    <span className="text-sm font-semibold">{employee.points} баллов</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Attestations */}
          <div className="border-b border-gray-100 px-5 py-4">
            <h3 className="font-semibold text-gray-900">История аттестаций</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {employeeAtts.map((attestation) => {
              const course = data.courses.find((item) => item.id === attestation.courseId);
              return (
                <div key={attestation.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-100">
                      <BookOpen className="h-4 w-4 text-teal-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{course?.title}</p>
                      <p className="text-xs text-gray-400">{attestation.date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium">{attestation.score}%</span>
                    <Badge variant={attestation.passed ? "success" : "danger"}>
                      {attestation.passed ? "Сдал" : "Не сдал"}
                    </Badge>
                  </div>
                </div>
              );
            })}
            {employeeAtts.length === 0 && (
              <div className="p-4 text-center text-sm text-gray-500">Нет аттестаций</div>
            )}
          </div>

          {/* Attempts */}
          <div className="border-t border-gray-100 px-5 py-4">
            <h4 className="text-sm font-semibold text-gray-700">Попытки прохождения</h4>
          </div>
          <div className="px-5 pb-5">
            {employeeAttempts.length === 0 ? (
              <p className="text-sm text-gray-500">Пока нет попыток</p>
            ) : (
              <div className="space-y-2">
                {employeeAttempts.map((attempt) => {
                  const course = data.courses.find((c) => c.id === attempt.courseId);
                  return (
                    <div
                      key={attempt.id}
                      className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span>{new Date(attempt.createdAt).toLocaleString()}</span>
                        <span className="text-gray-400">•</span>
                        <span>{course?.title}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium">{attempt.score}%</span>
                        <span className="text-xs text-gray-400">попытка #{attempt.attemptNo}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      </div>
    );
  }

  // Course list view
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Обучение</h1>
          <p className="mt-1 text-sm text-gray-500">Курсы и аттестации сотрудников</p>
        </div>
      </div>

      {lmsCoursesQuery.isLoading && (
        <div className="flex h-32 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-teal-200 border-t-teal-600" />
        </div>
      )}

      {lmsCoursesQuery.isError && (
        <Card className="border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-600">
            Не удалось загрузить курсы: {(lmsCoursesQuery.error as Error).message}
          </p>
        </Card>
      )}

      {/* Courses grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {visibleCourses.map((course) => (
          <Card key={course.id} hover className="overflow-hidden">
            <div className="p-5">
              <Badge variant="cyan" className="mb-3">
                {course.status === "published" ? "Опубликован" : course.status}
              </Badge>
              <h3 className="font-semibold text-gray-900">{course.title}</h3>
              <p className="mt-2 text-sm text-gray-500 line-clamp-2">
                {course.description ?? "Описание не заполнено"}
              </p>
              <Link
                to={`/lms/courses/${course.id}`}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700"
              >
                <BookOpen className="h-4 w-4" />
                Открыть курс
              </Link>
            </div>
          </Card>
        ))}
      </div>

      {!lmsCoursesQuery.isLoading && !lmsCoursesQuery.isError && visibleCourses.length === 0 && (
        <Card className="p-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
            <BookOpen className="h-6 w-6 text-gray-400" />
          </div>
          <p className="text-gray-500">Курсы пока не опубликованы.</p>
        </Card>
      )}

      {/* Employees section */}
      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100">
            <Users className="h-4 w-4 text-emerald-600" />
          </div>
          <h2 className="font-semibold text-gray-900">Сотрудники</h2>
        </div>
        <div className="grid grid-cols-1 gap-2 p-4 md:grid-cols-2 lg:grid-cols-3">
          {data.users
            .filter((item) => item.role !== "admin")
            .map((employee) => (
              <Link
                key={String(employee.id)}
                to={`/lms/users/${employee.id}`}
                className="flex items-center gap-3 rounded-xl border border-gray-100 p-3 transition-all hover:border-teal-200 hover:bg-teal-50"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 text-sm text-white">
                  {employee.avatar}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-gray-900">{employee.name}</p>
                  <p className="truncate text-xs text-gray-400">{employee.position}</p>
                </div>
              </Link>
            ))}
        </div>
      </Card>
    </div>
  );
}

