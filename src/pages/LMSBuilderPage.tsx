import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  Film,
  GripVertical,
  Image,
  Layers,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Settings,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "../components/ui/Badge";
import { useAuth } from "../contexts/useAuth";
import { canManageLMS } from "../lib/permissions";
import { backendApi } from "../services/apiClient";

type LmsStatus = "draft" | "published" | "archived";
type BuilderStep = "basic" | "structure" | "content" | "review";

// Status badge component
function StatusBadge({ status }: { status: LmsStatus }) {
  const config = {
    draft: { bg: "bg-amber-100", text: "text-amber-700", label: "Черновик" },
    published: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Опубликован" },
    archived: { bg: "bg-gray-100", text: "text-gray-600", label: "Архив" },
  };
  const c = config[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${c.bg} ${c.text}`}>
      {status === "draft" && <Clock className="h-3 w-3" />}
      {status === "published" && <CheckCircle2 className="h-3 w-3" />}
      {c.label}
    </span>
  );
}

// Markdown preview component
function MarkdownPreview({ markdown }: { markdown: string }) {
  const lines = markdown.split(/\r?\n/);
  return (
    <div className="prose prose-sm max-w-none space-y-2 text-gray-700">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-2" />;
        if (trimmed.startsWith("### "))
          return (
            <h4 key={idx} className="text-sm font-semibold text-gray-800">
              {trimmed.slice(4)}
            </h4>
          );
        if (trimmed.startsWith("## "))
          return (
            <h3 key={idx} className="text-base font-semibold text-gray-800">
              {trimmed.slice(3)}
            </h3>
          );
        if (trimmed.startsWith("# "))
          return (
            <h2 key={idx} className="text-lg font-bold text-gray-900">
              {trimmed.slice(2)}
            </h2>
          );
        if (trimmed.startsWith("- "))
          return (
            <li key={idx} className="ml-4 list-disc text-sm">
              {trimmed.slice(2)}
            </li>
          );
        if (trimmed.startsWith("**") && trimmed.endsWith("**"))
          return (
            <p key={idx} className="font-medium">
              {trimmed.slice(2, -2)}
            </p>
          );
        return (
          <p key={idx} className="text-sm">
            {trimmed}
          </p>
        );
      })}
    </div>
  );
}

// Step indicator component
function StepIndicator({
  steps,
  activeStep,
  onStepClick,
}: {
  steps: { key: BuilderStep; label: string; icon: React.ReactNode }[];
  activeStep: BuilderStep;
  onStepClick: (step: BuilderStep) => void;
}) {
  const currentIndex = steps.findIndex((s) => s.key === activeStep);

  return (
    <div className="flex items-center gap-1">
      {steps.map((step, idx) => {
        const isActive = step.key === activeStep;
        const isCompleted = idx < currentIndex;

        return (
          <div key={step.key} className="flex items-center">
            <button
              onClick={() => onStepClick(step.key)}
              className={`group flex items-center gap-2 rounded-lg px-4 py-2.5 transition-all duration-200 ${
                isActive
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
                  : isCompleted
                    ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100"
              }`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                  isActive
                    ? "bg-white/20 text-white"
                    : isCompleted
                      ? "bg-emerald-200 text-emerald-700"
                      : "bg-gray-200 text-gray-500"
                }`}
              >
                {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
              </span>
              <span className="hidden font-medium sm:block">{step.label}</span>
            </button>
            {idx < steps.length - 1 && (
              <div
                className={`mx-2 h-0.5 w-8 rounded-full transition-colors ${
                  idx < currentIndex ? "bg-emerald-300" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Course card component
function CourseCard({
  course,
  isSelected,
  onSelect,
  onStatusChange,
}: {
  course: { id: number | string; title: string; description?: string | null; status: LmsStatus };
  isSelected: boolean;
  onSelect: () => void;
  onStatusChange: (status: LmsStatus) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div
      className={`group relative cursor-pointer rounded-xl border p-3 transition-all duration-200 ${
        isSelected
          ? "border-indigo-300 bg-gradient-to-r from-indigo-50 to-purple-50 shadow-md"
          : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-medium text-gray-900">{course.title}</h3>
          <p className="mt-0.5 truncate text-xs text-gray-500">{course.description || "Без описания"}</p>
        </div>
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {showMenu && (
            <div
              className="absolute right-0 top-6 z-10 w-36 rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              {(["draft", "published", "archived"] as LmsStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    onStatusChange(s);
                    setShowMenu(false);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                    course.status === s ? "font-medium text-indigo-600" : "text-gray-700"
                  }`}
                >
                  <StatusBadge status={s} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="mt-2">
        <StatusBadge status={course.status} />
      </div>
    </div>
  );
}

// Section tree item
function SectionItem({
  section,
  isSelected,
  selectedSubsectionId,
  onSelect,
  onSelectSubsection,
  onDragStart,
  onDragOver,
  onDrop,
  draggedSectionId,
  draggedSubsectionId,
}: {
  section: {
    id: number | string;
    title: string;
    sort_order: number;
    subsections: Array<{ id: number | string; title: string; sort_order: number }>;
  };
  isSelected: boolean;
  selectedSubsectionId: number | null;
  onSelect: () => void;
  onSelectSubsection: (sectionId: number, subsectionId: number) => void;
  onDragStart: (sectionId: number) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (sectionId: number) => void;
  draggedSectionId: number | null;
  draggedSubsectionId: number | null;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const isDragging = draggedSectionId === Number(section.id);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart(Number(section.id));
      }}
      onDragOver={onDragOver}
      onDrop={() => onDrop(Number(section.id))}
      className={`rounded-lg transition-all duration-200 ${
        isDragging ? "opacity-50" : ""
      } ${isSelected ? "bg-indigo-50 ring-1 ring-indigo-200" : "hover:bg-gray-50"}`}
    >
      <div
        className={`flex items-center gap-2 rounded-lg p-2 ${draggedSectionId && !isDragging ? "cursor-grab" : ""}`}
        onClick={onSelect}
      >
        <GripVertical className="h-4 w-4 flex-shrink-0 cursor-grab text-gray-400" />
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="rounded p-0.5 hover:bg-gray-200"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-500" />
          )}
        </button>
        <span className="flex h-6 w-6 items-center justify-center rounded bg-indigo-100 text-xs font-semibold text-indigo-600">
          {section.sort_order}
        </span>
        <span className={`flex-1 truncate font-medium ${isSelected ? "text-indigo-700" : "text-gray-700"}`}>
          {section.title}
        </span>
        <Badge className="bg-gray-100 text-gray-600">{section.subsections.length}</Badge>
      </div>

      {isExpanded && section.subsections.length > 0 && (
        <div className="ml-10 space-y-1 pb-2">
          {section.subsections.map((sub) => {
            const isSubDragging = draggedSubsectionId === Number(sub.id);
            return (
              <div
                key={sub.id}
                draggable
                onDragStart={(e) => {
                  e.stopPropagation();
                  e.dataTransfer.effectAllowed = "move";
                }}
                onClick={() => onSelectSubsection(Number(section.id), Number(sub.id))}
                className={`flex cursor-pointer items-center gap-2 rounded-lg p-2 transition-all ${
                  isSubDragging ? "opacity-50" : ""
                } ${
                  selectedSubsectionId === Number(sub.id)
                    ? "bg-white shadow-sm ring-1 ring-indigo-300"
                    : "hover:bg-white/50"
                }`}
              >
                <GripVertical className="h-3 w-3 flex-shrink-0 cursor-grab text-gray-300" />
                <FileText className="h-4 w-4 flex-shrink-0 text-gray-400" />
                <span className="flex-1 truncate text-sm text-gray-600">{sub.title}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function LMSBuilderPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [activeStep, setActiveStep] = useState<BuilderStep>("basic");
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null);
  const [selectedSubsectionId, setSelectedSubsectionId] = useState<number | null>(null);

  const [draggedSectionId, setDraggedSectionId] = useState<number | null>(null);
  const [draggedSubsectionId] = useState<number | null>(null);

  const [courseSearch, setCourseSearch] = useState("");
  const [courseStatusFilter, setCourseStatusFilter] = useState<"all" | LmsStatus>("all");

  const [newCourseTitle, setNewCourseTitle] = useState("");
  const [newCourseDescription, setNewCourseDescription] = useState("");
  const [showNewCourseForm, setShowNewCourseForm] = useState(false);

  const [basicTitle, setBasicTitle] = useState("");
  const [basicDescription, setBasicDescription] = useState("");
  const [basicStatus, setBasicStatus] = useState<LmsStatus>("draft");

  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [newSubsectionTitle, setNewSubsectionTitle] = useState("");
  const [newSubsectionMarkdown, setNewSubsectionMarkdown] = useState("");

  const [editorTitle, setEditorTitle] = useState("");
  const [editorMarkdown, setEditorMarkdown] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoCaption, setVideoCaption] = useState("");
  const [showPreview, setShowPreview] = useState(true);

  const canManage = user ? canManageLMS(user.role) : false;

  const steps: { key: BuilderStep; label: string; icon: React.ReactNode }[] = [
    { key: "basic", label: "Основное", icon: <Settings className="h-4 w-4" /> },
    { key: "structure", label: "Структура", icon: <Layers className="h-4 w-4" /> },
    { key: "content", label: "Контент", icon: <FileText className="h-4 w-4" /> },
    { key: "review", label: "Публикация", icon: <CheckCircle2 className="h-4 w-4" /> },
  ];

  const coursesQuery = useQuery({
    queryKey: ["lms-builder-courses"],
    queryFn: () => backendApi.getLmsBuilderCourses(true),
    enabled: canManage,
  });

  const selectedCourse = useMemo(
    () => (coursesQuery.data ?? []).find((course) => Number(course.id) === selectedCourseId) ?? null,
    [coursesQuery.data, selectedCourseId]
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

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!selectedSubsection) {
      setEditorTitle("");
      setEditorMarkdown("");
      return;
    }
    setEditorTitle(selectedSubsection.title);
    setEditorMarkdown(selectedSubsection.markdown_content);
  }, [selectedSubsection]);

  useEffect(() => {
    if (!selectedCourse) {
      setBasicTitle("");
      setBasicDescription("");
      setBasicStatus("draft");
      return;
    }
    setBasicTitle(selectedCourse.title);
    setBasicDescription(selectedCourse.description ?? "");
    setBasicStatus(selectedCourse.status);
  }, [selectedCourse]);

  useEffect(() => {
    const sections = courseTreeQuery.data?.sections ?? [];
    if (!sections.length) return;
    if (selectedSectionId && sections.some((section) => Number(section.id) === selectedSectionId)) return;
    setSelectedSectionId(Number(sections[0].id));
  }, [courseTreeQuery.data, selectedSectionId]);
  /* eslint-enable react-hooks/set-state-in-effect */

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
        status: "draft",
      }),
    onSuccess: async (createdCourse) => {
      setNewCourseTitle("");
      setNewCourseDescription("");
      setShowNewCourseForm(false);
      setCourseSearch("");
      setCourseStatusFilter("all");
      setSelectedCourseId(Number((createdCourse as { id: number | string }).id));
      setActiveStep("basic");
      await refresh();
    },
  });

  const updateCourseMutation = useMutation({
    mutationFn: (input: { id: number; status: LmsStatus }) =>
      backendApi.updateLmsBuilderCourse(input.id, { status: input.status }),
    onSuccess: refresh,
  });

  const updateCourseDetailsMutation = useMutation({
    mutationFn: (input: { id: number; title: string; description: string; status: LmsStatus }) =>
      backendApi.updateLmsBuilderCourse(input.id, {
        title: input.title,
        description: input.description,
        status: input.status,
      }),
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

  const sections = courseTreeQuery.data?.sections ?? [];
  const subsectionCount = sections.reduce((sum, section) => sum + section.subsections.length, 0);
  const lessonsWithContent = sections.reduce(
    (sum, section) => sum + section.subsections.filter((item) => item.markdown_content.trim().length > 0).length,
    0
  );

  const reviewChecks = [
    { label: "Выбран курс", ok: Boolean(selectedCourse), icon: <CheckCircle2 className="h-5 w-5" /> },
    { label: "Есть название", ok: Boolean(basicTitle.trim()), icon: <Pencil className="h-5 w-5" /> },
    { label: "Есть описание", ok: Boolean(basicDescription.trim()), icon: <FileText className="h-5 w-5" /> },
    { label: "Есть разделы", ok: sections.length > 0, icon: <Layers className="h-5 w-5" /> },
    { label: "Есть уроки", ok: subsectionCount > 0, icon: <FileText className="h-5 w-5" /> },
    { label: "Есть контент уроков", ok: lessonsWithContent > 0, icon: <FileText className="h-5 w-5" /> },
  ];
  const canPublish = reviewChecks.every((item) => item.ok);

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
      list.map((section, idx) => updateSectionMutation.mutateAsync({ sectionId: Number(section.id), sortOrder: idx + 1 }))
    );
  };

  if (!canManage) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            <Settings className="h-8 w-8 text-gray-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Доступ ограничен</h2>
          <p className="mt-1 text-sm text-gray-500">Раздел доступен только директору и администратору.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-gray-50">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Конструктор курсов</h1>
            <p className="mt-1 text-sm text-gray-500">Создавайте и редактируйте учебные курсы</p>
          </div>
          <StepIndicator steps={steps} activeStep={activeStep} onStepClick={setActiveStep} />
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar - Course list */}
        <div className="w-80 flex-shrink-0 border-r border-gray-200 bg-white">
          <div className="flex h-full flex-col">
            {/* Search and filter */}
            <div className="border-b border-gray-100 p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={courseSearch}
                  onChange={(e) => setCourseSearch(e.target.value)}
                  placeholder="Поиск курсов..."
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 text-sm transition-colors focus:border-indigo-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <div className="mt-2 flex gap-2">
                {(["all", "draft", "published", "archived"] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setCourseStatusFilter(status)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      courseStatusFilter === status
                        ? "bg-indigo-100 text-indigo-700"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {status === "all" ? "Все" : status === "draft" ? "Черновики" : status === "published" ? "Опубликованные" : "Архив"}
                  </button>
                ))}
              </div>
            </div>

            {/* Course list */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-2">
                {filteredCourses.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    isSelected={selectedCourseId === Number(course.id)}
                    onSelect={() => {
                      setSelectedCourseId(Number(course.id));
                      setSelectedSectionId(null);
                      setSelectedSubsectionId(null);
                      setActiveStep("basic");
                    }}
                    onStatusChange={(status) => updateCourseMutation.mutate({ id: Number(course.id), status })}
                  />
                ))}
                {filteredCourses.length === 0 && (
                  <div className="py-8 text-center text-sm text-gray-500">Курсы не найдены</div>
                )}
              </div>
            </div>

            {/* New course button */}
            <div className="border-t border-gray-100 p-4">
              {showNewCourseForm ? (
                <div className="space-y-3 rounded-lg border border-indigo-200 bg-indigo-50/50 p-3">
                  <input
                    value={newCourseTitle}
                    onChange={(e) => setNewCourseTitle(e.target.value)}
                    placeholder="Название курса"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    autoFocus
                  />
                  <textarea
                    value={newCourseDescription}
                    onChange={(e) => setNewCourseDescription(e.target.value)}
                    placeholder="Описание курса"
                    rows={2}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => createCourseMutation.mutate()}
                      disabled={!newCourseTitle.trim() || createCourseMutation.isPending}
                      className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {createCourseMutation.isPending ? "Создание..." : "Создать"}
                    </button>
                    <button
                      onClick={() => {
                        setShowNewCourseForm(false);
                        setNewCourseTitle("");
                        setNewCourseDescription("");
                      }}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  {createCourseMutation.error && (
                    <p className="text-xs text-red-600">Ошибка: {createCourseMutation.error.message}</p>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setShowNewCourseForm(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-white py-3 text-sm font-medium text-gray-600 transition-colors hover:border-indigo-300 hover:text-indigo-600"
                >
                  <Plus className="h-4 w-4" />
                  Новый курс
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Middle panel - Structure */}
        <div className="w-96 flex-shrink-0 border-r border-gray-200 bg-white">
          <div className="flex h-full flex-col">
            <div className="border-b border-gray-100 p-4">
              <h2 className="font-semibold text-gray-900">
                {activeStep === "basic" && "Основные настройки"}
                {activeStep === "structure" && "Структура курса"}
                {activeStep === "content" && "Редактор контента"}
                {activeStep === "review" && "Проверка и публикация"}
              </h2>
              {selectedCourse && (
                <p className="mt-1 text-sm text-gray-500">{selectedCourse.title}</p>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {!selectedCourse ? (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                      <FileText className="h-6 w-6 text-gray-400" />
                    </div>
                    <p className="text-sm text-gray-500">Выберите курс для редактирования</p>
                  </div>
                </div>
              ) : activeStep === "basic" ? (
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">Название курса</label>
                    <input
                      value={basicTitle}
                      onChange={(e) => setBasicTitle(e.target.value)}
                      placeholder="Введите название"
                      className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">Описание</label>
                    <textarea
                      value={basicDescription}
                      onChange={(e) => setBasicDescription(e.target.value)}
                      placeholder="Опишите содержание курса"
                      rows={6}
                      className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">Статус</label>
                    <select
                      value={basicStatus}
                      onChange={(e) => setBasicStatus(e.target.value as LmsStatus)}
                      className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    >
                      <option value="draft">Черновик</option>
                      <option value="published">Опубликован</option>
                      <option value="archived">Архив</option>
                    </select>
                  </div>
                  <button
                    onClick={() =>
                      selectedCourseId &&
                      updateCourseDetailsMutation.mutate({
                        id: selectedCourseId,
                        title: basicTitle.trim(),
                        description: basicDescription.trim(),
                        status: basicStatus,
                      })
                    }
                    disabled={!selectedCourseId || !basicTitle.trim() || updateCourseDetailsMutation.isPending}
                    className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {updateCourseDetailsMutation.isPending ? "Сохранение..." : "Сохранить изменения"}
                  </button>
                  {updateCourseDetailsMutation.error && (
                    <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                      Ошибка: {updateCourseDetailsMutation.error.message}
                    </p>
                  )}
                </div>
              ) : activeStep === "structure" ? (
                <div className="space-y-4">
                  {/* Add section form */}
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <div className="flex items-center gap-2">
                      <input
                        value={newSectionTitle}
                        onChange={(e) => setNewSectionTitle(e.target.value)}
                        placeholder="Название нового раздела"
                        className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                      />
                      <button
                        onClick={() => createSectionMutation.mutate()}
                        disabled={!newSectionTitle.trim() || createSectionMutation.isPending}
                        className="rounded-lg bg-indigo-600 px-3 py-2 text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    {createSectionMutation.error && (
                      <p className="mt-2 text-xs text-red-600">Ошибка: {createSectionMutation.error.message}</p>
                    )}
                  </div>

                  {/* Sections list */}
                  <div className="space-y-2">
                    {sections.map((section) => (
                      <SectionItem
                        key={section.id}
                        section={section}
                        isSelected={selectedSectionId === Number(section.id)}
                        selectedSubsectionId={selectedSubsectionId}
                        onSelect={() => {
                          setSelectedSectionId(Number(section.id));
                          setSelectedSubsectionId(null);
                        }}
                        onSelectSubsection={(secId, subId) => {
                          setSelectedSectionId(secId);
                          setSelectedSubsectionId(subId);
                          setActiveStep("content");
                        }}
                        onDragStart={setDraggedSectionId}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={reorderSections}
                        draggedSectionId={draggedSectionId}
                        draggedSubsectionId={draggedSubsectionId}
                      />
                    ))}
                  </div>

                  {/* Add subsection form */}
                  {selectedSectionId && (
                    <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-3">
                      <p className="mb-2 text-sm font-medium text-indigo-700">Новый урок</p>
                      <input
                        value={newSubsectionTitle}
                        onChange={(e) => setNewSubsectionTitle(e.target.value)}
                        placeholder="Название урока"
                        className="mb-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                      />
                      <textarea
                        value={newSubsectionMarkdown}
                        onChange={(e) => setNewSubsectionMarkdown(e.target.value)}
                        placeholder="Содержание урока (markdown)"
                        rows={3}
                        className="mb-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 font-mono text-xs focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                      />
                      <button
                        onClick={() => createSubsectionMutation.mutate()}
                        disabled={!newSubsectionTitle.trim() || createSubsectionMutation.isPending}
                        className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                      >
                        Добавить урок
                      </button>
                      {createSubsectionMutation.error && (
                        <p className="mt-2 text-xs text-red-600">Ошибка: {createSubsectionMutation.error.message}</p>
                      )}
                    </div>
                  )}
                </div>
              ) : activeStep === "review" ? (
                <div className="space-y-4">
                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
                      <div className="text-2xl font-bold text-indigo-600">{sections.length}</div>
                      <div className="text-xs text-gray-500">Разделов</div>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
                      <div className="text-2xl font-bold text-indigo-600">{subsectionCount}</div>
                      <div className="text-xs text-gray-500">Уроков</div>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
                      <div className="text-2xl font-bold text-emerald-600">{lessonsWithContent}</div>
                      <div className="text-xs text-gray-500">С контентом</div>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
                      <div className="text-2xl font-bold text-gray-600">{selectedCourse?.status ?? "-"}</div>
                      <div className="text-xs text-gray-500">Статус</div>
                    </div>
                  </div>

                  {/* Checklist */}
                  <div className="rounded-lg border border-gray-200 bg-white">
                    <div className="border-b border-gray-100 px-4 py-3">
                      <h3 className="font-medium text-gray-900">Чек-лист публикации</h3>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {reviewChecks.map((item) => (
                        <div key={item.label} className="flex items-center gap-3 px-4 py-3">
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-full ${
                              item.ok ? "bg-emerald-100 text-emerald-600" : "bg-gray-100 text-gray-400"
                            }`}
                          >
                            {item.ok ? <CheckCircle2 className="h-4 w-4" /> : item.icon}
                          </div>
                          <span className={`text-sm ${item.ok ? "text-gray-700" : "text-gray-400"}`}>
                            {item.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Publish button */}
                  <button
                    onClick={() =>
                      selectedCourseId &&
                      updateCourseDetailsMutation.mutate({
                        id: selectedCourseId,
                        title: basicTitle.trim() || (selectedCourse?.title ?? ""),
                        description: basicDescription.trim() || (selectedCourse?.description ?? ""),
                        status: "published",
                      })
                    }
                    disabled={!selectedCourseId || !canPublish || updateCourseDetailsMutation.isPending}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Опубликовать курс
                  </button>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                      <FileText className="h-6 w-6 text-gray-400" />
                    </div>
                    <p className="text-sm text-gray-500">Выберите урок для редактирования</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right panel - Content editor */}
        <div className="flex-1 bg-gray-50">
          {activeStep !== "content" ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-200">
                  <FileText className="h-6 w-6 text-gray-400" />
                </div>
                <p className="text-sm text-gray-500">Переключитесь на шаг "Контент" для редактирования</p>
              </div>
            </div>
          ) : !selectedSubsection ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-200">
                  <FileText className="h-6 w-6 text-gray-400" />
                </div>
                <p className="text-sm text-gray-500">Выберите урок в структуре курса</p>
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col">
              {/* Editor header */}
              <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
                <div>
                  <h2 className="font-semibold text-gray-900">{selectedSubsection.title}</h2>
                  <p className="text-sm text-gray-500">Редактирование урока</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      showPreview ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    Предпросмотр
                  </button>
                </div>
              </div>

              {/* Editor content */}
              <div className="flex flex-1 overflow-hidden">
                {/* Editor */}
                <div className={`flex-1 overflow-y-auto p-6 ${showPreview ? "w-1/2" : ""}`}>
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">Название урока</label>
                      <input
                        value={editorTitle}
                        onChange={(e) => setEditorTitle(e.target.value)}
                        placeholder="Введите название"
                        className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">Содержание (Markdown)</label>
                      <textarea
                        value={editorMarkdown}
                        onChange={(e) => setEditorMarkdown(e.target.value)}
                        placeholder="# Заголовок урока&#10;&#10;Введите содержание урока в формате Markdown..."
                        rows={16}
                        className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 font-mono text-sm leading-relaxed focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>

                    {/* Media upload */}
                    <div className="rounded-lg border border-gray-200 bg-white p-4">
                      <h3 className="mb-3 text-sm font-medium text-gray-700">Медиафайлы</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-gray-500">
                            <Image className="mr-1 inline h-3 w-3" />
                            Изображение
                          </label>
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
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs file:mr-2 file:rounded file:border-0 file:bg-indigo-50 file:px-2 file:py-1 file:text-xs file:text-indigo-600"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-gray-500">
                            <Film className="mr-1 inline h-3 w-3" />
                            Видео ссылка
                          </label>
                          <input
                            value={videoUrl}
                            onChange={(e) => setVideoUrl(e.target.value)}
                            placeholder="https://youtube.com/..."
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs focus:border-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-100"
                          />
                        </div>
                      </div>
                      {videoUrl && (
                        <div className="mt-3">
                          <input
                            value={videoCaption}
                            onChange={(e) => setVideoCaption(e.target.value)}
                            placeholder="Подпись к видео"
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs focus:border-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-100"
                          />
                          <button
                            onClick={() => addVideoMutation.mutate()}
                            disabled={addVideoMutation.isPending}
                            className="mt-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                          >
                            Добавить видео
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Save button */}
                    <button
                      onClick={() =>
                        updateSubsectionMutation.mutate({
                          subsectionId: Number(selectedSubsection.id),
                          title: editorTitle,
                          markdownContent: editorMarkdown,
                        })
                      }
                      disabled={!editorTitle.trim() || updateSubsectionMutation.isPending}
                      className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {updateSubsectionMutation.isPending ? "Сохранение..." : "Сохранить урок"}
                    </button>
                    {updateSubsectionMutation.error && (
                      <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                        Ошибка: {updateSubsectionMutation.error.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* Preview */}
                {showPreview && (
                  <div className="w-1/2 flex-shrink-0 overflow-y-auto border-l border-gray-200 bg-white p-6">
                    <h3 className="mb-4 text-sm font-medium text-gray-500">Предпросмотр</h3>
                    <div className="rounded-lg border border-gray-200 bg-white p-6">
                      <MarkdownPreview markdown={editorMarkdown} />
                    </div>

                    {/* Media preview */}
                    {selectedSubsection.media.length > 0 && (
                      <div className="mt-6">
                        <h3 className="mb-3 text-sm font-medium text-gray-500">Медиафайлы</h3>
                        <div className="space-y-3">
                          {selectedSubsection.media.map((item) => (
                            <div key={item.id} className="rounded-lg border border-gray-200 bg-white p-3">
                              {item.media_type === "image" && item.image_data_base64 ? (
                                <img
                                  src={`data:${item.image_mime_type ?? "image/png"};base64,${item.image_data_base64}`}
                                  alt={item.caption ?? "image"}
                                  className="max-h-64 w-auto rounded-lg"
                                />
                              ) : item.media_type === "video" && item.external_url ? (
                                <a
                                  href={item.external_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center gap-2 text-indigo-600 hover:underline"
                                >
                                  <Film className="h-4 w-4" />
                                  {item.external_url}
                                </a>
                              ) : null}
                              {item.caption && <p className="mt-2 text-sm text-gray-500">{item.caption}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
