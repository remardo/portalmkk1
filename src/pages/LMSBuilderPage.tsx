import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { useAuth } from "../contexts/useAuth";
import { canManageLMS } from "../lib/permissions";
import { backendApi } from "../services/apiClient";

type LmsStatus = "draft" | "published" | "archived";
type UserRole = "operator" | "office_head" | "director" | "admin";

function MarkdownPreview({ markdown }: { markdown: string }) {
  const lines = markdown.split(/\r?\n/);
  return (
    <div className="space-y-2 text-sm text-gray-800">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-2" />;
        if (trimmed.startsWith("### ")) return <h4 key={idx} className="font-semibold">{trimmed.slice(4)}</h4>;
        if (trimmed.startsWith("## ")) return <h3 key={idx} className="font-semibold text-base">{trimmed.slice(3)}</h3>;
        if (trimmed.startsWith("# ")) return <h2 key={idx} className="font-bold text-lg">{trimmed.slice(2)}</h2>;
        if (trimmed.startsWith("- ")) return <li key={idx} className="ml-4 list-disc">{trimmed.slice(2)}</li>;
        return <p key={idx}>{trimmed}</p>;
      })}
    </div>
  );
}

export function LMSBuilderPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null);
  const [selectedSubsectionId, setSelectedSubsectionId] = useState<number | null>(null);
  const [draggedSectionId, setDraggedSectionId] = useState<number | null>(null);
  const [draggedSubsectionId, setDraggedSubsectionId] = useState<number | null>(null);

  const [newCourseTitle, setNewCourseTitle] = useState("");
  const [newCourseDescription, setNewCourseDescription] = useState("");
  const [newCourseStatus, setNewCourseStatus] = useState<LmsStatus>("draft");
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [newSubsectionTitle, setNewSubsectionTitle] = useState("");
  const [subsectionMarkdown, setSubsectionMarkdown] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoCaption, setVideoCaption] = useState("");
  const [mdImportTitle, setMdImportTitle] = useState("");
  const [mdImportText, setMdImportText] = useState("");
  const [assignmentRole, setAssignmentRole] = useState<UserRole | "">("");
  const [assignmentOfficeId, setAssignmentOfficeId] = useState<number | "">("");
  const [assignmentDueDate, setAssignmentDueDate] = useState("");
  const [assignmentUserIds, setAssignmentUserIds] = useState<string[]>([]);

  const [editingSectionId, setEditingSectionId] = useState<number | null>(null);
  const [editingSectionTitle, setEditingSectionTitle] = useState("");
  const [editingSubsectionId, setEditingSubsectionId] = useState<number | null>(null);
  const [editingSubsectionTitle, setEditingSubsectionTitle] = useState("");
  const [editingSubsectionMarkdown, setEditingSubsectionMarkdown] = useState("");

  const canManage = user ? canManageLMS(user.role) : false;

  const coursesQuery = useQuery({
    queryKey: ["lms-builder-courses"],
    queryFn: () => backendApi.getLmsBuilderCourses(true),
    enabled: canManage,
  });

  const selectedCourse = useMemo(
    () => (coursesQuery.data ?? []).find((c) => Number(c.id) === selectedCourseId) ?? null,
    [coursesQuery.data, selectedCourseId],
  );

  const courseTreeQuery = useQuery({
    queryKey: ["lms-builder-course", selectedCourseId],
    queryFn: () => backendApi.getLmsBuilderCourse(Number(selectedCourseId)),
    enabled: canManage && !!selectedCourseId,
  });

  const courseVersionsQuery = useQuery({
    queryKey: ["lms-builder-course-versions", selectedCourseId],
    queryFn: () => backendApi.getLmsBuilderCourseVersions(Number(selectedCourseId)),
    enabled: canManage && !!selectedCourseId,
  });

  const courseProgressQuery = useQuery({
    queryKey: ["lms-course-progress", selectedCourseId],
    queryFn: () => backendApi.getLmsCourseProgress(Number(selectedCourseId)),
    enabled: canManage && !!selectedCourseId,
  });

  const officesQuery = useQuery({
    queryKey: ["offices"],
    queryFn: () => backendApi.getOffices(),
    enabled: canManage,
  });

  const adminUsersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => backendApi.getAdminUsers(),
    enabled: canManage,
  });

  const courseAssignmentsQuery = useQuery({
    queryKey: ["lms-builder-course-assignments", selectedCourseId],
    queryFn: () => backendApi.getLmsBuilderCourseAssignments(Number(selectedCourseId)),
    enabled: canManage && !!selectedCourseId,
  });

  const selectedSubsection = useMemo(() => {
    const sections = courseTreeQuery.data?.sections ?? [];
    for (const section of sections) {
      const match = section.subsections.find((sub) => Number(sub.id) === selectedSubsectionId);
      if (match) return match;
    }
    return null;
  }, [courseTreeQuery.data, selectedSubsectionId]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["lms-builder-courses"] });
    if (selectedCourseId) {
      await queryClient.invalidateQueries({ queryKey: ["lms-builder-course", selectedCourseId] });
      await queryClient.invalidateQueries({ queryKey: ["lms-builder-course-versions", selectedCourseId] });
      await queryClient.invalidateQueries({ queryKey: ["lms-course-progress", selectedCourseId] });
      await queryClient.invalidateQueries({ queryKey: ["lms-builder-course-assignments", selectedCourseId] });
    }
  };

  const createCourseMutation = useMutation({
    mutationFn: () =>
      backendApi.createLmsBuilderCourse({
        title: newCourseTitle,
        description: newCourseDescription || undefined,
        status: newCourseStatus,
      }),
    onSuccess: async () => {
      setNewCourseTitle("");
      setNewCourseDescription("");
      setNewCourseStatus("draft");
      await refresh();
    },
  });

  const updateCourseMutation = useMutation({
    mutationFn: (input: { id: number; status: LmsStatus }) =>
      backendApi.updateLmsBuilderCourse(input.id, { status: input.status }),
    onSuccess: refresh,
  });

  const createSectionMutation = useMutation({
    mutationFn: () => backendApi.createLmsBuilderSection(Number(selectedCourseId), { title: newSectionTitle }),
    onSuccess: async () => {
      setNewSectionTitle("");
      await refresh();
    },
  });

  const updateSectionMutation = useMutation({
    mutationFn: (input: { sectionId: number; title?: string; sortOrder?: number }) =>
      backendApi.updateLmsBuilderSection(input.sectionId, { title: input.title, sortOrder: input.sortOrder }),
    onSuccess: refresh,
  });

  const createSubsectionMutation = useMutation({
    mutationFn: () =>
      backendApi.createLmsBuilderSubsection(Number(selectedSectionId), {
        title: newSubsectionTitle,
        markdownContent: subsectionMarkdown,
      }),
    onSuccess: async () => {
      setNewSubsectionTitle("");
      setSubsectionMarkdown("");
      await refresh();
    },
  });

  const updateSubsectionMutation = useMutation({
    mutationFn: (input: { subsectionId: number; title?: string; markdownContent?: string; sortOrder?: number }) =>
      backendApi.updateLmsBuilderSubsection(input.subsectionId, {
        title: input.title,
        markdownContent: input.markdownContent,
        sortOrder: input.sortOrder,
      }),
    onSuccess: refresh,
  });

  const addVideoMutation = useMutation({
    mutationFn: () =>
      backendApi.addLmsBuilderVideo(Number(selectedSubsectionId), {
        url: videoUrl,
        caption: videoCaption || undefined,
      }),
    onSuccess: async () => {
      setVideoUrl("");
      setVideoCaption("");
      await refresh();
    },
  });

  const importMarkdownMutation = useMutation({
    mutationFn: () =>
      backendApi.importLmsBuilderMarkdown({
        title: mdImportTitle,
        markdown: mdImportText,
        courseId: selectedCourseId ?? undefined,
        status: "draft",
      }),
    onSuccess: async () => {
      setMdImportTitle("");
      setMdImportText("");
      await refresh();
    },
  });

  const rollbackVersionMutation = useMutation({
    mutationFn: (input: { courseId: number; version: number }) =>
      backendApi.rollbackLmsBuilderCourseVersion(input.courseId, input.version),
    onSuccess: refresh,
  });

  const upsertSubsectionProgressMutation = useMutation({
    mutationFn: (input: { subsectionId: number; completed: boolean; progressPercent: number }) =>
      backendApi.upsertLmsSubsectionProgress(input.subsectionId, {
        completed: input.completed,
        progressPercent: input.progressPercent,
      }),
    onSuccess: refresh,
  });

  const assignCourseMutation = useMutation({
    mutationFn: () =>
      backendApi.assignLmsBuilderCourse(Number(selectedCourseId), {
        userIds: assignmentUserIds.length > 0 ? assignmentUserIds : undefined,
        role: assignmentRole || undefined,
        officeId: assignmentOfficeId === "" ? undefined : Number(assignmentOfficeId),
        dueDate: assignmentDueDate || undefined,
      }),
    onSuccess: async () => {
      setAssignmentRole("");
      setAssignmentOfficeId("");
      setAssignmentDueDate("");
      setAssignmentUserIds([]);
      await refresh();
    },
  });

  const subsectionProgressMap = useMemo(() => {
    const map = new Map<number, { completed: boolean; progressPercent: number }>();
    for (const section of courseProgressQuery.data?.sections ?? []) {
      for (const subsection of section.subsections) {
        map.set(Number(subsection.subsectionId), {
          completed: subsection.completed,
          progressPercent: subsection.progressPercent,
        });
      }
    }
    return map;
  }, [courseProgressQuery.data]);

  const selectedSubsectionProgress = selectedSubsectionId
    ? subsectionProgressMap.get(Number(selectedSubsectionId))
    : undefined;

  const assignmentCandidates = useMemo(() => {
    return (adminUsersQuery.data ?? []).filter((candidate) => {
      if (assignmentRole && candidate.role !== assignmentRole) {
        return false;
      }
      if (assignmentOfficeId !== "" && Number(candidate.office_id) !== Number(assignmentOfficeId)) {
        return false;
      }
      return true;
    });
  }, [adminUsersQuery.data, assignmentRole, assignmentOfficeId]);

  const reorderSections = async (targetSectionId: number) => {
    if (!draggedSectionId || !courseTreeQuery.data) return;
    if (draggedSectionId === targetSectionId) return;
    const list = [...courseTreeQuery.data.sections];
    const from = list.findIndex((s) => Number(s.id) === draggedSectionId);
    const to = list.findIndex((s) => Number(s.id) === targetSectionId);
    if (from < 0 || to < 0) return;
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    await Promise.all(
      list.map((section, idx) =>
        backendApi.updateLmsBuilderSection(Number(section.id), { sortOrder: idx + 1 }),
      ),
    );
    await refresh();
  };

  const reorderSubsections = async (sectionId: number, targetSubsectionId: number) => {
    if (!draggedSubsectionId || !courseTreeQuery.data) return;
    if (draggedSubsectionId === targetSubsectionId) return;
    const section = courseTreeQuery.data.sections.find((s) => Number(s.id) === sectionId);
    if (!section) return;
    const list = [...section.subsections];
    const from = list.findIndex((s) => Number(s.id) === draggedSubsectionId);
    const to = list.findIndex((s) => Number(s.id) === targetSubsectionId);
    if (from < 0 || to < 0) return;
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    await Promise.all(
      list.map((sub, idx) =>
        backendApi.updateLmsBuilderSubsection(Number(sub.id), { sortOrder: idx + 1 }),
      ),
    );
    await refresh();
  };

  if (!canManage) {
    return <p className="text-sm text-gray-500">Раздел доступен только директору и администратору.</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">LMS Конструктор</h1>

      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">Создать курс</h2>
        <input
          value={newCourseTitle}
          onChange={(e) => setNewCourseTitle(e.target.value)}
          placeholder="Название курса"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <textarea
          value={newCourseDescription}
          onChange={(e) => setNewCourseDescription(e.target.value)}
          placeholder="Описание курса"
          rows={3}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <select
          value={newCourseStatus}
          onChange={(e) => setNewCourseStatus(e.target.value as LmsStatus)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="draft">draft</option>
          <option value="published">published</option>
          <option value="archived">archived</option>
        </select>
        <button
          onClick={() => createCourseMutation.mutate()}
          disabled={!newCourseTitle.trim() || createCourseMutation.isPending}
          className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          Создать курс
        </button>
      </Card>

      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">Импорт из Markdown</h2>
        <input
          value={mdImportTitle}
          onChange={(e) => setMdImportTitle(e.target.value)}
          placeholder="Название курса для импорта"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <textarea
          value={mdImportText}
          onChange={(e) => setMdImportText(e.target.value)}
          placeholder="## Раздел, ### Подраздел. Видео - обычная ссылка. Фото - data:image/...;base64,..."
          rows={8}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs"
        />
        <button
          onClick={() => importMarkdownMutation.mutate()}
          disabled={!mdImportTitle.trim() || !mdImportText.trim() || importMarkdownMutation.isPending}
          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          Импортировать
        </button>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="space-y-3 p-4">
          <h2 className="font-semibold">Курсы</h2>
          <div className="space-y-2">
            {(coursesQuery.data ?? []).map((course) => (
              <div
                key={course.id}
                className={`rounded-lg border p-3 ${selectedCourseId === Number(course.id) ? "border-indigo-400 bg-indigo-50" : "border-gray-200"}`}
              >
                <button onClick={() => setSelectedCourseId(Number(course.id))} className="w-full text-left">
                  <p className="font-medium">{course.title}</p>
                  <Badge className="mt-1 bg-purple-100 text-purple-700">{course.status}</Badge>
                </button>
                <div className="mt-2 flex items-center gap-2">
                  <select
                    value={course.status}
                    onChange={(e) =>
                      updateCourseMutation.mutate({ id: Number(course.id), status: e.target.value as LmsStatus })
                    }
                    className="rounded border border-gray-300 px-2 py-1 text-xs"
                  >
                    <option value="draft">draft</option>
                    <option value="published">published</option>
                    <option value="archived">archived</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="space-y-3 p-4">
          <h2 className="font-semibold">Структура курса</h2>
          {!selectedCourseId || !selectedCourse ? (
            <p className="text-sm text-gray-500">Выберите курс слева.</p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">{selectedCourse.description ?? "Без описания"}</p>
              <p className="text-xs text-gray-500">
                Прогресс: {courseProgressQuery.data?.completionPercent ?? 0}% •
                Изучено подразделов: {courseProgressQuery.data?.completedSubsections ?? 0}/
                {courseProgressQuery.data?.totalSubsections ?? 0}
              </p>

              <div className="rounded-lg border border-gray-200 p-3">
                <p className="mb-2 text-sm font-semibold">Версии курса</p>
                <div className="max-h-52 space-y-2 overflow-auto">
                  {(courseVersionsQuery.data ?? []).slice(0, 20).map((versionItem) => (
                    <div key={versionItem.id} className="flex items-center justify-between gap-2 rounded border border-gray-100 p-2 text-xs">
                      <div>
                        <p className="font-medium">v{versionItem.version}</p>
                        <p className="text-gray-500">{versionItem.reason}</p>
                      </div>
                      <button
                        onClick={() =>
                          rollbackVersionMutation.mutate({
                            courseId: Number(selectedCourse.id),
                            version: Number(versionItem.version),
                          })
                        }
                        disabled={rollbackVersionMutation.isPending}
                        className="rounded bg-amber-600 px-2 py-1 text-white hover:bg-amber-700 disabled:opacity-60"
                      >
                        Откатить
                      </button>
                    </div>
                  ))}
                  {courseVersionsQuery.data && courseVersionsQuery.data.length === 0 ? (
                    <p className="text-xs text-gray-500">Версий пока нет.</p>
                  ) : null}
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 p-3">
                <p className="mb-2 text-sm font-semibold">Назначения курса</p>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <select
                    value={assignmentRole}
                    onChange={(e) => setAssignmentRole(e.target.value as UserRole | "")}
                    className="rounded border border-gray-300 px-2 py-1 text-xs"
                  >
                    <option value="">Все роли</option>
                    <option value="operator">operator</option>
                    <option value="office_head">office_head</option>
                    <option value="director">director</option>
                    <option value="admin">admin</option>
                  </select>
                  <select
                    value={assignmentOfficeId}
                    onChange={(e) =>
                      setAssignmentOfficeId(e.target.value ? Number(e.target.value) : "")
                    }
                    className="rounded border border-gray-300 px-2 py-1 text-xs"
                  >
                    <option value="">Все офисы</option>
                    {(officesQuery.data ?? []).map((office) => (
                      <option key={office.id} value={office.id}>
                        {office.name}
                      </option>
                    ))}
                  </select>
                </div>

                <input
                  value={assignmentDueDate}
                  onChange={(e) => setAssignmentDueDate(e.target.value)}
                  type="date"
                  className="mt-2 w-full rounded border border-gray-300 px-2 py-1 text-xs"
                />

                <div className="mt-2 max-h-40 space-y-1 overflow-auto rounded border border-gray-100 p-2">
                  {assignmentCandidates.map((candidate) => {
                    const checked = assignmentUserIds.includes(candidate.id);
                    return (
                      <label key={candidate.id} className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setAssignmentUserIds((prev) =>
                              e.target.checked
                                ? [...prev, candidate.id]
                                : prev.filter((id) => id !== candidate.id),
                            );
                          }}
                        />
                        <span>
                          {candidate.full_name} ({candidate.role})
                        </span>
                      </label>
                    );
                  })}
                  {assignmentCandidates.length === 0 ? (
                    <p className="text-xs text-gray-500">Нет сотрудников по фильтрам.</p>
                  ) : null}
                </div>

                <button
                  onClick={() => assignCourseMutation.mutate()}
                  disabled={
                    assignCourseMutation.isPending ||
                    (!assignmentRole && assignmentOfficeId === "" && assignmentUserIds.length === 0)
                  }
                  className="mt-2 rounded bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  Назначить курс
                </button>

                <div className="mt-3 max-h-44 space-y-1 overflow-auto rounded border border-gray-100 p-2">
                  {(courseAssignmentsQuery.data ?? []).map((assignment) => (
                    <div key={assignment.id} className="rounded border border-gray-100 p-2 text-xs">
                      <p className="font-medium">{assignment.profile?.full_name ?? assignment.user_id}</p>
                      <p className="text-gray-500">
                        срок: {assignment.due_date ?? "не задан"} • роль: {assignment.profile?.role ?? "-"} •
                        офис: {assignment.profile?.office_id ?? "-"}
                      </p>
                    </div>
                  ))}
                  {courseAssignmentsQuery.data && courseAssignmentsQuery.data.length === 0 ? (
                    <p className="text-xs text-gray-500">Назначений пока нет.</p>
                  ) : null}
                </div>
              </div>

              <input
                value={newSectionTitle}
                onChange={(e) => setNewSectionTitle(e.target.value)}
                placeholder="Новый раздел"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <button
                onClick={() => createSectionMutation.mutate()}
                disabled={!newSectionTitle.trim() || createSectionMutation.isPending}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                Добавить раздел
              </button>

              {(courseTreeQuery.data?.sections ?? []).map((section) => (
                <div
                  key={section.id}
                  draggable
                  onDragStart={() => setDraggedSectionId(Number(section.id))}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => reorderSections(Number(section.id))}
                  className="rounded-lg border border-gray-200 p-3"
                >
                  <div className="flex items-center gap-2">
                    {editingSectionId === Number(section.id) ? (
                      <>
                        <input
                          value={editingSectionTitle}
                          onChange={(e) => setEditingSectionTitle(e.target.value)}
                          className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
                        />
                        <button
                          onClick={() => {
                            updateSectionMutation.mutate({ sectionId: Number(section.id), title: editingSectionTitle });
                            setEditingSectionId(null);
                          }}
                          className="rounded bg-indigo-600 px-2 py-1 text-xs text-white"
                        >
                          Сохранить
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setSelectedSectionId(Number(section.id))}
                          className="text-left font-semibold text-gray-900"
                        >
                          {section.sort_order}. {section.title}
                        </button>
                        <button
                          onClick={() => {
                            setEditingSectionId(Number(section.id));
                            setEditingSectionTitle(section.title);
                          }}
                          className="rounded bg-gray-100 px-2 py-1 text-xs"
                        >
                          Редактировать
                        </button>
                      </>
                    )}
                  </div>

                  <div className="mt-2 space-y-2">
                    {section.subsections.map((sub) => (
                      <div
                        key={sub.id}
                        draggable
                        onDragStart={() => setDraggedSubsectionId(Number(sub.id))}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => reorderSubsections(Number(section.id), Number(sub.id))}
                        className={`rounded border p-2 text-sm ${selectedSubsectionId === Number(sub.id) ? "border-indigo-400 bg-indigo-50" : "border-gray-200"}`}
                      >
                        {editingSubsectionId === Number(sub.id) ? (
                          <div className="space-y-2">
                            <input
                              value={editingSubsectionTitle}
                              onChange={(e) => setEditingSubsectionTitle(e.target.value)}
                              className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                            />
                            <textarea
                              value={editingSubsectionMarkdown}
                              onChange={(e) => setEditingSubsectionMarkdown(e.target.value)}
                              rows={6}
                              className="w-full rounded border border-gray-300 px-2 py-1 font-mono text-xs"
                            />
                            <button
                              onClick={() => {
                                updateSubsectionMutation.mutate({
                                  subsectionId: Number(sub.id),
                                  title: editingSubsectionTitle,
                                  markdownContent: editingSubsectionMarkdown,
                                });
                                setEditingSubsectionId(null);
                              }}
                              className="rounded bg-indigo-600 px-2 py-1 text-xs text-white"
                            >
                              Сохранить
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2">
                            <button
                              onClick={() => setSelectedSubsectionId(Number(sub.id))}
                              className="text-left"
                            >
                              {sub.sort_order}. {sub.title}
                              {subsectionProgressMap.get(Number(sub.id))?.completed ? " ✅" : ""}
                            </button>
                            <button
                              onClick={() => {
                                setEditingSubsectionId(Number(sub.id));
                                setEditingSubsectionTitle(sub.title);
                                setEditingSubsectionMarkdown(sub.markdown_content);
                              }}
                              className="rounded bg-gray-100 px-2 py-1 text-xs"
                            >
                              Редактировать
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {selectedSectionId ? (
        <Card className="space-y-3 p-4">
          <h2 className="font-semibold">Добавить подраздел</h2>
          <input
            value={newSubsectionTitle}
            onChange={(e) => setNewSubsectionTitle(e.target.value)}
            placeholder="Название подраздела"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <textarea
            value={subsectionMarkdown}
            onChange={(e) => setSubsectionMarkdown(e.target.value)}
            placeholder="Markdown содержимое"
            rows={8}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs"
          />
          <button
            onClick={() => createSubsectionMutation.mutate()}
            disabled={!newSubsectionTitle.trim() || createSubsectionMutation.isPending}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            Сохранить подраздел
          </button>
        </Card>
      ) : null}

      {selectedSubsectionId && selectedSubsection ? (
        <>
          <Card className="space-y-3 p-4">
            <h2 className="font-semibold">Медиа подраздела</h2>
            <p className="text-xs text-gray-500">
              Фото: загрузка в БД (base64). Видео: сохраняем внешнюю ссылку.
            </p>

            <label className="text-sm font-medium">Загрузить фото</label>
            <input
              type="file"
              accept="image/*"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file || !selectedSubsectionId) return;
                const reader = new FileReader();
                reader.onload = async () => {
                  const result = String(reader.result ?? "");
                  await backendApi.addLmsBuilderImage(selectedSubsectionId, {
                    dataBase64: result,
                    mimeType: file.type || "image/png",
                  });
                  await refresh();
                };
                reader.readAsDataURL(file);
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />

            <label className="text-sm font-medium">Ссылка на видео</label>
            <input
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://youtube.com/..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              value={videoCaption}
              onChange={(e) => setVideoCaption(e.target.value)}
              placeholder="Подпись (опционально)"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <button
              onClick={() => addVideoMutation.mutate()}
              disabled={!videoUrl.trim() || addVideoMutation.isPending}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              Добавить видео
            </button>
          </Card>

          <Card className="space-y-3 p-4">
            <h2 className="font-semibold">Предпросмотр подраздела</h2>
            <h3 className="font-medium">{selectedSubsection.title}</h3>
            <p className="text-xs text-gray-500">
              Статус:{" "}
              {selectedSubsectionProgress?.completed
                ? "изучен"
                : `в процессе (${selectedSubsectionProgress?.progressPercent ?? 0}%)`}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() =>
                  upsertSubsectionProgressMutation.mutate({
                    subsectionId: Number(selectedSubsection.id),
                    completed: true,
                    progressPercent: 100,
                  })
                }
                disabled={upsertSubsectionProgressMutation.isPending}
                className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                Отметить изученным
              </button>
              <button
                onClick={() =>
                  upsertSubsectionProgressMutation.mutate({
                    subsectionId: Number(selectedSubsection.id),
                    completed: false,
                    progressPercent: 0,
                  })
                }
                disabled={upsertSubsectionProgressMutation.isPending}
                className="rounded bg-gray-200 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-300 disabled:opacity-60"
              >
                Сбросить
              </button>
            </div>
            <MarkdownPreview markdown={selectedSubsection.markdown_content} />

            <div className="space-y-3">
              {selectedSubsection.media.map((item) => (
                <div key={item.id} className="rounded-lg border border-gray-200 p-3">
                  {item.media_type === "image" && item.image_data_base64 ? (
                    <img
                      src={`data:${item.image_mime_type ?? "image/png"};base64,${item.image_data_base64}`}
                      alt={item.caption ?? "course image"}
                      className="max-h-80 w-auto rounded"
                    />
                  ) : null}
                  {item.media_type === "video" && item.external_url ? (
                    <a href={item.external_url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
                      {item.external_url}
                    </a>
                  ) : null}
                  {item.caption ? <p className="mt-2 text-sm text-gray-500">{item.caption}</p> : null}
                </div>
              ))}
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}
