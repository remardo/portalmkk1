import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { useAuth } from "../contexts/useAuth";
import { canManageLMS } from "../lib/permissions";
import { backendApi } from "../services/apiClient";

type LmsStatus = "draft" | "published" | "archived";

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

export function LMSBuilderPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null);
  const [selectedSubsectionId, setSelectedSubsectionId] = useState<number | null>(null);

  const [draggedSectionId, setDraggedSectionId] = useState<number | null>(null);
  const [draggedSubsectionId, setDraggedSubsectionId] = useState<number | null>(null);

  const [courseSearch, setCourseSearch] = useState("");
  const [courseStatusFilter, setCourseStatusFilter] = useState<"all" | LmsStatus>("all");

  const [newCourseTitle, setNewCourseTitle] = useState("");
  const [newCourseDescription, setNewCourseDescription] = useState("");
  const [newCourseStatus, setNewCourseStatus] = useState<LmsStatus>("draft");

  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [newSubsectionTitle, setNewSubsectionTitle] = useState("");
  const [newSubsectionMarkdown, setNewSubsectionMarkdown] = useState("");

  const [editorTitle, setEditorTitle] = useState("");
  const [editorMarkdown, setEditorMarkdown] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoCaption, setVideoCaption] = useState("");

  const canManage = user ? canManageLMS(user.role) : false;

  const coursesQuery = useQuery({
    queryKey: ["lms-builder-courses"],
    queryFn: () => backendApi.getLmsBuilderCourses(true),
    enabled: canManage,
  });

  const selectedCourse = useMemo(
    () => (coursesQuery.data ?? []).find((course) => Number(course.id) === selectedCourseId) ?? null,
    [coursesQuery.data, selectedCourseId],
  );

  const courseTreeQuery = useQuery({
    queryKey: ["lms-builder-course", selectedCourseId],
    queryFn: () => backendApi.getLmsBuilderCourse(Number(selectedCourseId)),
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

  useEffect(() => {
    if (!selectedSubsection) {
      setEditorTitle("");
      setEditorMarkdown("");
      return;
    }
    setEditorTitle(selectedSubsection.title);
    setEditorMarkdown(selectedSubsection.markdown_content);
  }, [selectedSubsection]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["lms-builder-courses"] });
    if (selectedCourseId) {
      await queryClient.invalidateQueries({ queryKey: ["lms-builder-course", selectedCourseId] });
    }
  };

  const createCourseMutation = useMutation({
    mutationFn: () =>
      backendApi.createLmsBuilderCourse({
        title: newCourseTitle,
        description: newCourseDescription || undefined,
        status: newCourseStatus,
      }),
    onSuccess: async (createdCourse) => {
      setNewCourseTitle("");
      setNewCourseDescription("");
      setNewCourseStatus("draft");
      setCourseSearch("");
      setCourseStatusFilter("all");
      setSelectedCourseId(Number((createdCourse as { id: number | string }).id));
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
    mutationFn: (input: { sectionId: number; sortOrder?: number }) =>
      backendApi.updateLmsBuilderSection(input.sectionId, { sortOrder: input.sortOrder }),
    onSuccess: refresh,
  });

  const createSubsectionMutation = useMutation({
    mutationFn: () =>
      backendApi.createLmsBuilderSubsection(Number(selectedSectionId), {
        title: newSubsectionTitle,
        markdownContent: newSubsectionMarkdown,
      }),
    onSuccess: async () => {
      setNewSubsectionTitle("");
      setNewSubsectionMarkdown("");
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

  const courses = coursesQuery.data ?? [];
  const filteredCourses = useMemo(() => {
    return courses
      .filter((course) => {
        if (courseStatusFilter !== "all" && course.status !== courseStatusFilter) return false;
        const q = courseSearch.trim().toLowerCase();
        if (!q) return true;
        return course.title.toLowerCase().includes(q) || (course.description ?? "").toLowerCase().includes(q);
      })
      .sort((a, b) => Number(b.id) - Number(a.id));
  }, [courses, courseSearch, courseStatusFilter]);

  const reorderSections = async (targetSectionId: number) => {
    if (!draggedSectionId || !courseTreeQuery.data) return;
    if (draggedSectionId === targetSectionId) return;

    const list = [...courseTreeQuery.data.sections];
    const from = list.findIndex((s) => Number(s.id) === draggedSectionId);
    const to = list.findIndex((s) => Number(s.id) === targetSectionId);
    if (from < 0 || to < 0) return;

    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    await Promise.all(list.map((section, idx) => updateSectionMutation.mutateAsync({ sectionId: Number(section.id), sortOrder: idx + 1 })));
  };

  const reorderSubsections = async (sectionId: number, targetSubsectionId: number) => {
    if (!draggedSubsectionId || !courseTreeQuery.data) return;
    if (draggedSubsectionId === targetSubsectionId) return;

    const section = courseTreeQuery.data.sections.find((item) => Number(item.id) === sectionId);
    if (!section) return;

    const list = [...section.subsections];
    const from = list.findIndex((s) => Number(s.id) === draggedSubsectionId);
    const to = list.findIndex((s) => Number(s.id) === targetSubsectionId);
    if (from < 0 || to < 0) return;

    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    await Promise.all(
      list.map((sub, idx) =>
        updateSubsectionMutation.mutateAsync({ subsectionId: Number(sub.id), sortOrder: idx + 1 }),
      ),
    );
  };

  if (!canManage) {
    return <p className="text-sm text-gray-500">Раздел доступен только директору и администратору.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-white via-indigo-50/60 to-white p-5">
        <h1 className="text-2xl font-bold text-gray-900">LMS Конструктор</h1>
        <p className="mt-1 text-sm text-gray-600">
          Один экран: выберите курс, настройте структуру и сразу редактируйте выбранный урок.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card className="space-y-3 p-4 xl:col-span-3">
          <h2 className="font-semibold">Курсы</h2>
          <div className="space-y-2">
            <input
              value={courseSearch}
              onChange={(e) => setCourseSearch(e.target.value)}
              placeholder="Поиск курса..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <select
              value={courseStatusFilter}
              onChange={(e) => setCourseStatusFilter(e.target.value as "all" | LmsStatus)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="all">Все статусы</option>
              <option value="draft">draft</option>
              <option value="published">published</option>
              <option value="archived">archived</option>
            </select>
          </div>

          <div className="max-h-[320px] space-y-2 overflow-auto pr-1">
            {filteredCourses.map((course) => (
              <div
                key={course.id}
                className={`rounded-lg border p-3 ${selectedCourseId === Number(course.id) ? "border-indigo-400 bg-indigo-50" : "border-gray-200"}`}
              >
                <button
                  onClick={() => {
                    setSelectedCourseId(Number(course.id));
                    setSelectedSectionId(null);
                    setSelectedSubsectionId(null);
                  }}
                  className="w-full text-left"
                >
                  <p className="font-medium text-gray-900">{course.title}</p>
                  <p className="text-xs text-gray-500">{course.description ?? "Без описания"}</p>
                </button>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <Badge className="bg-purple-100 text-purple-700">{course.status}</Badge>
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
            {filteredCourses.length === 0 ? <p className="text-sm text-gray-500">Курсы не найдены.</p> : null}
          </div>

          <div className="space-y-2 border-t border-gray-200 pt-3">
            <p className="text-sm font-semibold">Создать курс</p>
            <input
              value={newCourseTitle}
              onChange={(e) => setNewCourseTitle(e.target.value)}
              placeholder="Название курса"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <textarea
              value={newCourseDescription}
              onChange={(e) => setNewCourseDescription(e.target.value)}
              rows={3}
              placeholder="Краткое описание"
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
            {createCourseMutation.error ? (
              <p className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700">
                Не удалось создать курс: {createCourseMutation.error.message}
              </p>
            ) : null}
            <button
              onClick={() => createCourseMutation.mutate()}
              disabled={!newCourseTitle.trim() || createCourseMutation.isPending}
              className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {createCourseMutation.isPending ? "Создание..." : "Создать курс"}
            </button>
          </div>
        </Card>

        <Card className="space-y-3 p-4 xl:col-span-4">
          <h2 className="font-semibold">Структура курса</h2>
          {!selectedCourse ? (
            <p className="text-sm text-gray-500">Выберите курс слева.</p>
          ) : (
            <>
              <p className="text-sm text-gray-600">{selectedCourse.title}</p>
              <div className="space-y-2">
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
              </div>

              <div className="max-h-[560px] space-y-2 overflow-auto pr-1">
                {(courseTreeQuery.data?.sections ?? []).map((section) => (
                  <div
                    key={section.id}
                    draggable
                    onDragStart={() => setDraggedSectionId(Number(section.id))}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => reorderSections(Number(section.id))}
                    className={`rounded-lg border p-3 ${selectedSectionId === Number(section.id) ? "border-indigo-400 bg-indigo-50" : "border-gray-200"}`}
                  >
                    <button
                      onClick={() => {
                        setSelectedSectionId(Number(section.id));
                        setSelectedSubsectionId(null);
                      }}
                      className="text-left font-semibold text-gray-900"
                    >
                      {section.sort_order}. {section.title}
                    </button>

                    <div className="mt-2 space-y-1">
                      {section.subsections.map((sub) => (
                        <div
                          key={sub.id}
                          draggable
                          onDragStart={() => setDraggedSubsectionId(Number(sub.id))}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => reorderSubsections(Number(section.id), Number(sub.id))}
                          className={`rounded border p-2 text-sm ${selectedSubsectionId === Number(sub.id) ? "border-indigo-400 bg-white" : "border-gray-200 bg-gray-50"}`}
                        >
                          <button
                            onClick={() => {
                              setSelectedSectionId(Number(section.id));
                              setSelectedSubsectionId(Number(sub.id));
                            }}
                            className="w-full text-left"
                          >
                            {sub.sort_order}. {sub.title}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {selectedSectionId ? (
                <div className="space-y-2 border-t border-gray-200 pt-3">
                  <p className="text-sm font-semibold">Новый урок в выбранном разделе</p>
                  <input
                    value={newSubsectionTitle}
                    onChange={(e) => setNewSubsectionTitle(e.target.value)}
                    placeholder="Название урока"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                  <textarea
                    value={newSubsectionMarkdown}
                    onChange={(e) => setNewSubsectionMarkdown(e.target.value)}
                    rows={5}
                    placeholder="Содержание урока (markdown)"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs"
                  />
                  <button
                    onClick={() => createSubsectionMutation.mutate()}
                    disabled={!newSubsectionTitle.trim() || createSubsectionMutation.isPending}
                    className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                  >
                    Добавить урок
                  </button>
                </div>
              ) : null}
            </>
          )}
        </Card>

        <Card className="space-y-3 p-4 xl:col-span-5">
          <h2 className="font-semibold">Редактор урока</h2>
          {!selectedSubsection ? (
            <p className="text-sm text-gray-500">Выберите урок в структуре курса.</p>
          ) : (
            <>
              <input
                value={editorTitle}
                onChange={(e) => setEditorTitle(e.target.value)}
                placeholder="Название урока"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <textarea
                value={editorMarkdown}
                onChange={(e) => setEditorMarkdown(e.target.value)}
                rows={12}
                placeholder="Содержимое урока (markdown)"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs"
              />
              <button
                onClick={() =>
                  updateSubsectionMutation.mutate({
                    subsectionId: Number(selectedSubsection.id),
                    title: editorTitle,
                    markdownContent: editorMarkdown,
                  })
                }
                disabled={!editorTitle.trim() || updateSubsectionMutation.isPending}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                Сохранить урок
              </button>

              <div className="grid grid-cols-1 gap-2 border-t border-gray-200 pt-3">
                <label className="text-sm font-medium">Добавить изображение</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file || !selectedSubsectionId) return;
                    const reader = new FileReader();
                    reader.onload = async () => {
                      await backendApi.addLmsBuilderImage(selectedSubsectionId, {
                        dataBase64: String(reader.result ?? ""),
                        mimeType: file.type || "image/png",
                      });
                      await refresh();
                    };
                    reader.readAsDataURL(file);
                  }}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />

                <label className="text-sm font-medium">Добавить видео (ссылка)</label>
                <input
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://youtube.com/..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <input
                  value={videoCaption}
                  onChange={(e) => setVideoCaption(e.target.value)}
                  placeholder="Подпись к видео"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <button
                  onClick={() => addVideoMutation.mutate()}
                  disabled={!videoUrl.trim() || addVideoMutation.isPending}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  Добавить видео
                </button>
              </div>

              <div className="space-y-3 border-t border-gray-200 pt-3">
                <p className="text-sm font-semibold text-gray-700">Предпросмотр</p>
                <MarkdownPreview markdown={editorMarkdown} />
                {selectedSubsection.media.map((item) => (
                  <div key={item.id} className="rounded-lg border border-gray-200 p-3">
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
                    {item.caption ? <p className="mt-2 text-sm text-gray-500">{item.caption}</p> : null}
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
