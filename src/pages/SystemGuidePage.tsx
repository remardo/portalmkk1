import { BookOpen, CheckCircle2, GraduationCap, MousePointerClick } from "lucide-react";
import { Card } from "../components/ui/Card";

interface GuideSection {
  title: string;
  why: string;
  steps: string[];
}

const guideSections: GuideSection[] = [
  {
    title: "Дашборд",
    why: "Это главная страница. Тут ты быстро видишь, что происходит: задачи, новости и важные цифры.",
    steps: [
      "Открой раздел «Дашборд».",
      "Посмотри карточки сверху: сколько задач и что срочное.",
      "Если видишь просроченные задачи, перейди в «Задачи» и закрой самые важные первыми.",
    ],
  },
  {
    title: "Новости",
    why: "Здесь публикуются важные объявления для команды.",
    steps: [
      "Открой «Новости».",
      "Сначала читай закрепленные сообщения.",
      "Если у тебя роль руководителя или админа, можно создать новость и закрепить ее.",
    ],
  },
  {
    title: "База знаний",
    why: "Это библиотека полезных инструкций и ответов.",
    steps: [
      "Перейди в «База знаний».",
      "Выбери тему и открой статью.",
      "Если нужна правка, используй обновление статьи (если у тебя есть права).",
    ],
  },
  {
    title: "Обучение (LMS)",
    why: "Здесь проходят курсы и проверка знаний.",
    steps: [
      "Открой «Обучение (LMS)».",
      "Выбери назначенный курс и прочитай материал по порядку.",
      "Пройди тест или аттестацию и проверь результат.",
    ],
  },
  {
    title: "Документооборот",
    why: "Здесь создаются и согласуются рабочие документы.",
    steps: [
      "Открой «Документооборот».",
      "Создай документ из шаблона или с нуля.",
      "Отправь на согласование и следи за статусом: черновик, на проверке, одобрен или отклонен.",
    ],
  },
  {
    title: "Задачи",
    why: "Здесь видно, что нужно сделать, к какому сроку и кем.",
    steps: [
      "Открой «Задачи».",
      "Фильтруй задачи по статусу: новые, в работе, готово, просрочено.",
      "Открой задачу и обнови статус, когда продвинулся по работе.",
    ],
  },
  {
    title: "Уведомления",
    why: "Тут собраны напоминания о важных событиях.",
    steps: [
      "Нажми на иконку колокольчика вверху.",
      "Открой новые уведомления.",
      "Отметь прочитанными, чтобы не путаться.",
    ],
  },
  {
    title: "Поиск",
    why: "Если не знаешь, где документ или статья, поиск поможет найти быстрее.",
    steps: [
      "Введи слово в поле «Поиск» сверху.",
      "Нажми Enter и открой раздел «Поиск».",
      "Перейди в найденный материал и продолжи работу.",
    ],
  },
  {
    title: "Отчеты и Оперцентр",
    why: "Эти разделы помогают руководителям видеть картину по офисам и качеству процессов.",
    steps: [
      "Открой «Отчеты», чтобы посмотреть KPI и детализацию.",
      "Если есть доступ, в «Оперцентр» проверь SLO, SLA и интеграции уведомлений.",
      "Используй эти данные, чтобы находить узкие места и исправлять их.",
    ],
  },
];

export function SystemGuidePage() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-5">
        <div className="flex items-start gap-3">
          <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
          <div>
            <h1 className="text-2xl font-bold text-emerald-900">Как пользоваться системой: просто и по шагам</h1>
            <p className="mt-1 text-sm text-emerald-800">
              Представь, что это школьный дневник, только для работы. У каждого раздела своя роль: где читать новости,
              где делать задачи, где учиться и где отправлять документы.
            </p>
          </div>
        </div>
      </div>

      <Card className="p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
          <MousePointerClick className="h-4 w-4 text-indigo-600" />
          С чего начать в первый день
        </h2>
        <ol className="mt-3 list-inside list-decimal space-y-2 text-sm text-gray-700">
          <li>Посмотри «Дашборд», чтобы понять, что срочно.</li>
          <li>Открой «Задачи» и возьми в работу ближайшие по сроку.</li>
          <li>Проверь «Новости» и «Уведомления», чтобы не пропустить важное.</li>
          <li>Если назначено обучение, зайди в «Обучение (LMS)» и начни курс.</li>
        </ol>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {guideSections.map((section) => (
          <Card key={section.title} className="p-4 sm:p-5">
            <h3 className="text-base font-semibold text-gray-900">{section.title}</h3>
            <p className="mt-1 text-sm text-gray-600">{section.why}</p>
            <ul className="mt-3 space-y-2 text-sm text-gray-700">
              {section.steps.map((step) => (
                <li key={step} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      <Card className="border-indigo-100 bg-indigo-50 p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold text-indigo-900">
          <GraduationCap className="h-4 w-4" />
          Маленькое правило
        </h2>
        <p className="mt-1 text-sm text-indigo-800">
          Если сомневаешься, делай так: сначала читай уведомления и новости, потом выполняй задачи, и только после этого
          переходи к отчетам и настройкам.
        </p>
      </Card>
    </div>
  );
}
