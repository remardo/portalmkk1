import { Link } from "react-router-dom";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { useLayoutContext } from "../hooks/useLayoutContext";
import { useUnifiedSearchQuery } from "../hooks/usePortalData";

export function SearchPage() {
  const { searchQuery } = useLayoutContext();
  const query = searchQuery.trim();
  const search = useUnifiedSearchQuery({ q: query, limit: 30 });

  if (query.length < 2) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900">Поиск</h1>
        <p className="text-sm text-gray-500">Введите минимум 2 символа в строке поиска сверху.</p>
      </div>
    );
  }

  const data = search.data;
  const docsCount = data?.documents.length ?? 0;
  const kbCount = data?.kb.length ?? 0;
  const lmsCount = data?.lms.length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Поиск</h1>
        <p className="text-sm text-gray-500">
          Запрос: <span className="font-medium text-gray-700">{query}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card className="p-3">
          <p className="text-sm text-gray-500">Документы</p>
          <p className="text-xl font-bold text-gray-900">{docsCount}</p>
        </Card>
        <Card className="p-3">
          <p className="text-sm text-gray-500">База знаний</p>
          <p className="text-xl font-bold text-gray-900">{kbCount}</p>
        </Card>
        <Card className="p-3">
          <p className="text-sm text-gray-500">LMS</p>
          <p className="text-xl font-bold text-gray-900">{lmsCount}</p>
        </Card>
      </div>

      {search.isLoading ? <p className="text-sm text-gray-500">Идёт поиск...</p> : null}
      {search.isError ? <p className="text-sm text-red-600">Не удалось выполнить поиск.</p> : null}

      {data ? (
        <div className="space-y-4">
          <Card className="p-4">
            <h2 className="mb-2 font-semibold text-gray-900">Документы</h2>
            <div className="space-y-2">
              {data.documents.map((item) => (
                <div key={`doc-${item.id}`} className="rounded-lg border border-gray-200 p-3">
                  <div className="mb-1 flex items-center gap-2">
                    <Badge className="bg-amber-100 text-amber-700">{item.status}</Badge>
                    <span className="text-xs text-gray-500">{item.date}</span>
                  </div>
                  <p className="font-medium text-gray-900">{item.title}</p>
                  {item.excerpt ? <p className="text-sm text-gray-600">{item.excerpt}</p> : null}
                  <Link to={item.href} className="mt-1 inline-block text-xs text-teal-600 hover:text-teal-800">
                    Открыть раздел →
                  </Link>
                </div>
              ))}
              {data.documents.length === 0 ? <p className="text-sm text-gray-500">Ничего не найдено.</p> : null}
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="mb-2 font-semibold text-gray-900">База знаний</h2>
            <div className="space-y-2">
              {data.kb.map((item) => (
                <div key={`kb-${item.id}`} className="rounded-lg border border-gray-200 p-3">
                  <div className="mb-1 flex items-center gap-2">
                    <Badge className="bg-teal-100 text-teal-700">{item.category}</Badge>
                    <span className="text-xs text-gray-500">{item.status}</span>
                  </div>
                  <p className="font-medium text-gray-900">{item.title}</p>
                  {item.excerpt ? <p className="text-sm text-gray-600">{item.excerpt}</p> : null}
                  <Link to={item.href} className="mt-1 inline-block text-xs text-teal-600 hover:text-teal-800">
                    Открыть →
                  </Link>
                </div>
              ))}
              {data.kb.length === 0 ? <p className="text-sm text-gray-500">Ничего не найдено.</p> : null}
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="mb-2 font-semibold text-gray-900">LMS</h2>
            <div className="space-y-2">
              {data.lms.map((item) => (
                <div key={item.id} className="rounded-lg border border-gray-200 p-3">
                  <div className="mb-1 flex items-center gap-2">
                    <Badge className="bg-cyan-100 text-cyan-700">{item.kind}</Badge>
                    <span className="text-xs text-gray-500">{item.status}</span>
                  </div>
                  <p className="font-medium text-gray-900">{item.title}</p>
                  {item.courseTitle ? <p className="text-xs text-gray-500">Курс: {item.courseTitle}</p> : null}
                  {item.sectionTitle ? <p className="text-xs text-gray-500">Раздел: {item.sectionTitle}</p> : null}
                  {item.excerpt ? <p className="text-sm text-gray-600">{item.excerpt}</p> : null}
                  <Link to={item.href} className="mt-1 inline-block text-xs text-teal-600 hover:text-teal-800">
                    Открыть раздел →
                  </Link>
                </div>
              ))}
              {data.lms.length === 0 ? <p className="text-sm text-gray-500">Ничего не найдено.</p> : null}
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

