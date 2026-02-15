import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Award,
  BookOpen,
  Check,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  HelpCircle,
  ListChecks,
  Play,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { useAuth } from "../contexts/useAuth";
import { backendApi } from "../services/apiClient";

// Types for quiz data
interface QuizOption {
  id: number;
  option_text: string;
  is_correct: boolean;
  sort_order: number;
}

interface QuizMatchingPair {
  id: number;
  left_text: string;
  right_text: string;
  sort_order: number;
}

interface QuizQuestion {
  id: number;
  quiz_id: number;
  question_type: "single_choice" | "multiple_choice" | "text_answer" | "matching" | "ordering";
  question_text: string;
  hint: string | null;
  explanation: string | null;
  image_url: string | null;
  points: number;
  sort_order: number;
  options?: QuizOption[];
  matching_pairs?: QuizMatchingPair[];
}

interface Quiz {
  id: number;
  title: string;
  description: string | null;
  quiz_type: "quiz" | "survey" | "exam";
  subsection_id: number | null;
  course_id: number;
  passing_score: number;
  max_attempts: number | null;
  time_limit_minutes: number | null;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  show_correct_answers: boolean;
  show_explanations: boolean;
  is_required: boolean;
  sort_order: number;
  status: "draft" | "published" | "archived";
  questions?: QuizQuestion[];
}

interface Subsection {
  id: number;
  section_id: number;
  title: string;
  sort_order: number;
  markdown_content: string;
  media: Array<{
    id: number;
    subsection_id: number;
    media_type: "image" | "video";
    image_data_base64: string | null;
    image_mime_type: string | null;
    external_url: string | null;
    caption: string | null;
    sort_order: number;
  }>;
  quizzes?: Quiz[];
}

interface Section {
  id: number;
  course_id: number;
  title: string;
  sort_order: number;
  subsections: Subsection[];
}

interface Course {
  id: number;
  title: string;
  description: string | null;
  status: "draft" | "published" | "archived";
  sections: Section[];
}

interface QuizAttempt {
  id: number;
  quiz_id: number;
  user_id: string;
  attempt_no: number;
  score: number;
  max_score: number;
  score_percent: number;
  passed: boolean;
  started_at: string;
  submitted_at: string | null;
  time_spent_seconds: number | null;
  answers: Array<{
    questionId: number;
    selectedOptions?: number[];
    textAnswer?: string;
    matchingAnswers?: Array<{ leftId: number; rightId: number }>;
    isCorrect?: boolean;
    points?: number;
  }>;
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
        return (
          <p key={idx} className="text-sm">
            {trimmed}
          </p>
        );
      })}
    </div>
  );
}

// Quiz type labels
const quizTypeLabels: Record<string, { label: string; color: string }> = {
  quiz: { label: "Тест", color: "bg-blue-100 text-blue-700" },
  survey: { label: "Опрос", color: "bg-green-100 text-green-700" },
  exam: { label: "Экзамен", color: "bg-red-100 text-red-700" },
};

// Quiz component
function QuizPlayer({
  quiz,
  attempt,
  onComplete,
  onClose,
}: {
  quiz: Quiz;
  attempt: QuizAttempt | null;
  onComplete: () => void;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<
    Array<{
      questionId: number;
      selectedOptions: number[];
      textAnswer: string;
      matchingAnswers: Array<{ leftId: number; rightId: number }>;
    }>
  >([]);
  const [showResults, setShowResults] = useState(false);
  const [submittedResults, setSubmittedResults] = useState<QuizAttempt | null>(null);

  const questions = quiz.questions || [];
  const currentQuestion = questions[currentQuestionIndex];

  // Initialize answers from existing attempt or create new
  useEffect(() => {
    if (attempt && attempt.answers) {
      setAnswers(
        attempt.answers.map((a) => ({
          questionId: a.questionId,
          selectedOptions: a.selectedOptions || [],
          textAnswer: a.textAnswer || "",
          matchingAnswers: a.matchingAnswers || [],
        }))
      );
      if (attempt.submitted_at) {
        setShowResults(true);
        setSubmittedResults(attempt);
      }
    } else if (questions.length > 0) {
      setAnswers(
        questions.map((q) => ({
          questionId: q.id,
          selectedOptions: [],
          textAnswer: "",
          matchingAnswers: q.matching_pairs?.map((p) => ({ leftId: p.id, rightId: p.id })) || [],
        }))
      );
    }
  }, [attempt, questions]);

  const submitQuizMutation = useMutation({
    mutationFn: async () => {
      // In real implementation, this would call the API
      // For now, we'll simulate the grading
      let correctCount = 0;
      let totalPoints = 0;

      questions.forEach((q, idx) => {
        const answer = answers[idx];
        totalPoints += q.points;

        if (q.question_type === "single_choice" || q.question_type === "multiple_choice") {
          const correctOptions = q.options?.filter((o) => o.is_correct).map((o) => o.id) || [];
          const selectedOptions = answer.selectedOptions;
          const isCorrect =
            correctOptions.length === selectedOptions.length &&
            correctOptions.every((c) => selectedOptions.includes(c));
          if (isCorrect) correctCount += q.points;
        }
      });

      const scorePercent = Math.round((correctCount / totalPoints) * 100);
      const passed = scorePercent >= quiz.passing_score;

      return {
        score: correctCount,
        max_score: totalPoints,
        score_percent: scorePercent,
        passed,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quiz-attempts", quiz.id] });
      onComplete();
    },
  });

  const handleAnswerSelect = (optionId: number, isMultiple: boolean) => {
    setAnswers((prev) => {
      const newAnswers = [...prev];
      const currentAnswer = newAnswers[currentQuestionIndex];

      if (isMultiple) {
        const index = currentAnswer.selectedOptions.indexOf(optionId);
        if (index > -1) {
          currentAnswer.selectedOptions = currentAnswer.selectedOptions.filter((id) => id !== optionId);
        } else {
          currentAnswer.selectedOptions = [...currentAnswer.selectedOptions, optionId];
        }
      } else {
        currentAnswer.selectedOptions = [optionId];
      }

      return newAnswers;
    });
  };

  const handleSubmit = () => {
    submitQuizMutation.mutate();
  };

  if (questions.length === 0) {
    return (
      <Card className="p-6">
        <div className="text-center">
          <HelpCircle className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-2 text-gray-500">В тесте пока нет вопросов.</p>
          <button
            onClick={onClose}
            className="mt-4 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            Закрыть
          </button>
        </div>
      </Card>
    );
  }

  if (showResults && submittedResults) {
    return (
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white">
          <h2 className="text-xl font-bold">Результаты: {quiz.title}</h2>
        </div>
        <div className="p-6">
          <div className="mb-6 flex items-center justify-center">
            <div
              className={`flex h-24 w-24 items-center justify-center rounded-full ${
                submittedResults.passed ? "bg-green-100" : "bg-red-100"
              }`}
            >
              {submittedResults.passed ? (
                <CheckCircle className="h-12 w-12 text-green-600" />
              ) : (
                <XCircle className="h-12 w-12 text-red-600" />
              )}
            </div>
          </div>
          <div className="mb-6 text-center">
            <p className="text-3xl font-bold text-gray-900">{submittedResults.score_percent}%</p>
            <p className="text-sm text-gray-500">
              {submittedResults.score} из {submittedResults.max_score} баллов
            </p>
            <p className={`mt-2 text-sm font-medium ${submittedResults.passed ? "text-green-600" : "text-red-600"}`}>
              {submittedResults.passed ? "Тест пройден успешно!" : "Тест не пройден"}
            </p>
          </div>

          {quiz.show_correct_answers && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">Ответы:</h3>
              {questions.map((q, idx) => {
                const answer = answers[idx];
                const isCorrect =
                  q.question_type === "single_choice" || q.question_type === "multiple_choice"
                    ? q.options
                        ?.filter((o) => o.is_correct)
                        .every((o) => answer.selectedOptions.includes(o.id)) &&
                      answer.selectedOptions.length === q.options?.filter((o) => o.is_correct).length
                    : false;

                return (
                  <div key={q.id} className="rounded-lg border border-gray-200 p-4">
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-6 w-6 items-center justify-center rounded-full ${
                          isCorrect ? "bg-green-100" : "bg-red-100"
                        }`}
                      >
                        {isCorrect ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <X className="h-4 w-4 text-red-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{q.question_text}</p>
                        {q.options && (
                          <div className="mt-2 space-y-1">
                            {q.options.map((opt) => (
                              <div
                                key={opt.id}
                                className={`rounded px-3 py-1 text-sm ${
                                  opt.is_correct
                                    ? "bg-green-50 text-green-700"
                                    : answer.selectedOptions.includes(opt.id)
                                    ? "bg-red-50 text-red-700"
                                    : "bg-gray-50 text-gray-600"
                                }`}
                              >
                                {opt.option_text}
                                {opt.is_correct && " ✓"}
                              </div>
                            ))}
                          </div>
                        )}
                        {quiz.show_explanations && q.explanation && (
                          <p className="mt-2 text-sm text-gray-500">{q.explanation}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-6 flex justify-center gap-3">
            {!submittedResults.passed && (
              <button
                onClick={() => {
                  setShowResults(false);
                  setSubmittedResults(null);
                  setAnswers(
                    questions.map((q) => ({
                      questionId: q.id,
                      selectedOptions: [],
                      textAnswer: "",
                      matchingAnswers: q.matching_pairs?.map((p) => ({ leftId: p.id, rightId: p.id })) || [],
                    }))
                  );
                  setCurrentQuestionIndex(0);
                }}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Попробовать снова
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
            >
              Закрыть
            </button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      {/* Quiz header */}
      <div className="border-b border-gray-100 bg-gray-50 px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100">
              <ListChecks className="h-4 w-4 text-indigo-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">{quiz.title}</h2>
              <p className="text-xs text-gray-500">
                Вопрос {currentQuestionIndex + 1} из {questions.length}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${quizTypeLabels[quiz.quiz_type].color}`}>
              {quizTypeLabels[quiz.quiz_type].label}
            </span>
            <span className="text-xs text-gray-500">Проходной балл: {quiz.passing_score}%</span>
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-3 h-2 w-full rounded-full bg-gray-200">
          <div
            className="h-2 rounded-full bg-indigo-600 transition-all"
            style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Question content */}
      <div className="p-6">
        <div className="mb-6">
          <p className="text-lg font-medium text-gray-900">{currentQuestion?.question_text}</p>
          {currentQuestion?.hint && (
            <p className="mt-2 text-sm text-gray-500">
              <span className="font-medium">Подсказка:</span> {currentQuestion.hint}
            </p>
          )}
        </div>

        {/* Answer options */}
        {currentQuestion && (currentQuestion.question_type === "single_choice" || currentQuestion.question_type === "multiple_choice") && (
          <div className="space-y-2">
            {currentQuestion.options?.map((option) => {
              const isSelected = answers[currentQuestionIndex]?.selectedOptions.includes(option.id);
              return (
                <button
                  key={option.id}
                  onClick={() => handleAnswerSelect(option.id, currentQuestion.question_type === "multiple_choice")}
                  className={`w-full rounded-lg border-2 p-4 text-left transition-all ${
                    isSelected
                      ? "border-indigo-500 bg-indigo-50"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded-${
                        currentQuestion.question_type === "multiple_choice" ? "sm" : "full"
                      } border-2 ${
                        isSelected
                          ? "border-indigo-500 bg-indigo-500 text-white"
                          : "border-gray-300"
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    <span className="text-gray-900">{option.option_text}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Navigation */}
        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
            disabled={currentQuestionIndex === 0}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
            Назад
          </button>

          {currentQuestionIndex === questions.length - 1 ? (
            <button
              onClick={handleSubmit}
              disabled={submitQuizMutation.isPending}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitQuizMutation.isPending ? "Отправка..." : "Завершить тест"}
            </button>
          ) : (
            <button
              onClick={() => setCurrentQuestionIndex((prev) => Math.min(questions.length - 1, prev + 1))}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Далее
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}

// Main Lesson Page component
export function LessonPage() {
  const { courseId, lessonId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);

  // Fetch course data
  const courseQuery = useQuery({
    queryKey: ["lms-course", Number(courseId)],
    queryFn: () => backendApi.getLmsBuilderCourse(Number(courseId)),
    enabled: Boolean(courseId && !Number.isNaN(courseId)),
  });

  // Find current lesson (subsection)
  const lesson = courseQuery.data?.sections
    .flatMap((s) => s.subsections)
    .find((sub) => String(sub.id) === lessonId);

  // Find section containing this lesson
  const section = courseQuery.data?.sections.find((s) =>
    s.subsections.some((sub) => String(sub.id) === lessonId)
  );

  // Fetch quizzes for this lesson (subsection)
  const quizzesQuery = useQuery({
    queryKey: ["lms-quizzes", Number(lessonId)],
    queryFn: () => backendApi.getLmsQuizzes(Number(lessonId)),
    enabled: Boolean(lessonId && !Number.isNaN(lessonId)),
  });

  const lessonQuizzes = (quizzesQuery.data || []).map((q) => ({
    ...q,
    questions: [],
  })) as Quiz[];

  // Get all lessons for navigation
  const allLessons =
    courseQuery.data?.sections.flatMap((s) =>
      s.subsections.map((sub) => ({
        ...sub,
        sectionId: s.id,
        sectionTitle: s.title,
      }))
    ) || [];

  const currentLessonIndex = allLessons.findIndex((l) => String(l.id) === lessonId);
  const prevLesson = currentLessonIndex > 0 ? allLessons[currentLessonIndex - 1] : null;
  const nextLesson = currentLessonIndex < allLessons.length - 1 ? allLessons[currentLessonIndex + 1] : null;

  // Fetch lesson progress
  const progressQuery = useQuery({
    queryKey: ["lms-progress", Number(courseId)],
    queryFn: () => backendApi.getLmsCourseProgress(Number(courseId)),
    enabled: Boolean(courseId && !Number.isNaN(courseId)),
  });

  // Mark lesson as complete mutation
  const completeMutation = useMutation({
    mutationFn: () =>
      backendApi.upsertLmsSubsectionProgress(Number(lessonId), {
        completed: true,
        progressPercent: 100,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lms-progress", Number(courseId)] });
    },
  });

  const queryClient = useQueryClient();

  // Loading state
  if (courseQuery.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
          <p className="text-sm text-gray-500">Загрузка урока...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (courseQuery.isError || !courseQuery.data || !lesson) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <BookOpen className="h-6 w-6 text-red-600" />
          </div>
          <p className="text-sm text-gray-500">Урок не найден.</p>
          <Link
            to={`/lms/courses/${courseId}`}
            className="mt-4 inline-block text-sm text-indigo-600 hover:underline"
          >
            Вернуться к курсу
          </Link>
        </div>
      </div>
    );
  }

  const course = courseQuery.data;
  const lessonProgress = progressQuery.data?.sections
    .flatMap((s) => s.subsections)
    .find((sub) => String(sub.subsectionId) === lessonId);

  // If quiz is active, show quiz player
  if (activeQuiz) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <button
          onClick={() => setActiveQuiz(null)}
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-indigo-600"
        >
          <ChevronLeft className="h-4 w-4" />
          Вернуться к уроку
        </button>
        <QuizPlayer
          quiz={activeQuiz}
          attempt={null}
          onComplete={() => {
            setActiveQuiz(null);
            queryClient.invalidateQueries({ queryKey: ["lms-progress", Number(courseId)] });
          }}
          onClose={() => setActiveQuiz(null)}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link
          to="/lms"
          className="text-gray-500 transition-colors hover:text-indigo-600"
        >
          Курсы
        </Link>
        <ChevronRight className="h-4 w-4 text-gray-400" />
        <Link
          to={`/lms/courses/${courseId}`}
          className="text-gray-500 transition-colors hover:text-indigo-600"
        >
          {course.title}
        </Link>
        <ChevronRight className="h-4 w-4 text-gray-400" />
        <span className="text-gray-900">{lesson.title}</span>
      </div>

      {/* Lesson header */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-indigo-100">{section?.title}</p>
              <h1 className="mt-1 text-2xl font-bold">{lesson.title}</h1>
            </div>
            {lessonProgress?.completed && (
              <div className="flex items-center gap-2 rounded-full bg-white/20 px-3 py-1">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Пройден</span>
              </div>
            )}
          </div>
        </div>

        {/* Progress indicator */}
        <div className="border-b border-gray-100 bg-gray-50 px-5 py-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">
              Урок {currentLessonIndex + 1} из {allLessons.length}
            </span>
            <span className="text-gray-500">
              {Math.round(((currentLessonIndex + 1) / allLessons.length) * 100)}% курса
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full rounded-full bg-gray-200">
            <div
              className="h-1.5 rounded-full bg-indigo-600 transition-all"
              style={{ width: `${((currentLessonIndex + 1) / allLessons.length) * 100}%` }}
            />
          </div>
        </div>
      </Card>

      {/* Lesson content */}
      <Card className="p-6">
        <MarkdownPreview markdown={lesson.markdown_content ?? ""} />

        {/* Media */}
        {(lesson.media ?? []).length > 0 && (
          <div className="mt-6 space-y-4">
            {lesson.media.map((item) => (
              <div
                key={item.id}
                className="overflow-hidden rounded-xl border border-gray-100 bg-gray-50"
              >
                {item.media_type === "image" && item.image_data_base64 ? (
                  <img
                    src={`data:${item.image_mime_type ?? "image/png"};base64,${item.image_data_base64}`}
                    alt={item.caption ?? "image"}
                    className="max-h-96 w-auto rounded-t-xl"
                  />
                ) : item.media_type === "video" && item.external_url ? (
                  <a
                    href={item.external_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 p-4 text-indigo-600 transition-colors hover:bg-indigo-50"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100">
                      <Play className="h-6 w-6" />
                    </div>
                    <span className="font-medium">{item.external_url}</span>
                  </a>
                ) : null}
                {item.caption && (
                  <p className="border-t border-gray-100 bg-white px-4 py-2 text-sm text-gray-500">
                    {item.caption}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Quizzes attached to this lesson */}
      {lessonQuizzes.length > 0 && (
        <Card className="overflow-hidden">
          <div className="border-b border-gray-100 bg-gray-50 px-5 py-4">
            <div className="flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-indigo-600" />
              <h2 className="font-semibold text-gray-900">Тесты и опросы</h2>
            </div>
          </div>
          <div className="divide-y divide-gray-50">
            {lessonQuizzes.map((quiz) => (
              <div key={quiz.id} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100">
                    <Award className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{quiz.title}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span className={`rounded-full px-2 py-0.5 ${quizTypeLabels[quiz.quiz_type].color}`}>
                        {quizTypeLabels[quiz.quiz_type].label}
                      </span>
                      <span>•</span>
                      <span>Проходной балл: {quiz.passing_score}%</span>
                      {quiz.max_attempts && (
                        <>
                          <span>•</span>
                          <span>Попыток: {quiz.max_attempts}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setActiveQuiz(quiz)}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
                >
                  Начать
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Mark as complete button */}
      {!lessonProgress?.completed && (
        <button
          onClick={() => completeMutation.mutate()}
          disabled={completeMutation.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
        >
          {completeMutation.isPending ? (
            "Сохранение..."
          ) : (
            <>
              <CheckCircle className="h-5 w-5" />
              Отметить как пройденный
            </>
          )}
        </button>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        {prevLesson ? (
          <Link
            to={`/lms/courses/${courseId}/lessons/${prevLesson.id}`}
            className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:border-indigo-300 hover:text-indigo-600"
          >
            <ChevronLeft className="h-4 w-4" />
            <div className="text-left">
              <p className="text-xs text-gray-400">Предыдущий урок</p>
              <p className="truncate max-w-48">{prevLesson.title}</p>
            </div>
          </Link>
        ) : (
          <div />
        )}

        {nextLesson ? (
          <Link
            to={`/lms/courses/${courseId}/lessons/${nextLesson.id}`}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
          >
            <div className="text-right">
              <p className="text-xs text-indigo-200">Следующий урок</p>
              <p className="truncate max-w-48">{nextLesson.title}</p>
            </div>
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <Link
            to={`/lms/courses/${courseId}`}
            className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
          >
            <CheckCircle className="h-4 w-4" />
            Завершить курс
          </Link>
        )}
      </div>
    </div>
  );
}
