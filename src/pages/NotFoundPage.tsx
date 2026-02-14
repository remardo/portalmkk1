import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold text-gray-900">Страница не найдена</h1>
      <Link to="/" className="text-sm text-indigo-600 hover:text-indigo-800">
        На главную
      </Link>
    </div>
  );
}