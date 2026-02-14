import { Link, useParams } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { useLayoutContext } from "../hooks/useLayoutContext";
import {
  useCreateKbArticleMutation,
  usePortalData,
  useRestoreKbArticleVersionMutation,
  useUpdateKbArticleMutation,
} from "../hooks/usePortalData";
import { useAuth } from "../contexts/useAuth";
import { canManageKB } from "../lib/permissions";
import { useState } from "react";

export function KBPage() {
  const { data } = usePortalData();
  const { searchQuery } = useLayoutContext();
  const [articleId] = [useParams().articleId];
  const { user } = useAuth();
  const createArticle = useCreateKbArticleMutation();
  const updateArticle = useUpdateKbArticleMutation();
  const restoreVersion = useRestoreKbArticleVersionMutation();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Регламенты");
  const [content, setContent] = useState("");

  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editStatus, setEditStatus] = useState<"draft" | "review" | "published" | "archived">("published");

  if (!data) {
    return null;
  }

  const canManage = user ? canManageKB(user.role) : false;

  if (articleId) {
    const article = data.kbArticles.find((item) => item.id === Number(articleId));
    if (!article) {
      return <p className="text-sm text-gray-500">Статья не найдена.</p>;
    }

    const versions = data.kbArticleVersions.filter((v) => v.articleId === article.id).slice(0, 5);

    return (
      <div className="space-y-4">
        <Link to="/kb" className="text-sm text-indigo-600 hover:text-indigo-800">
          ← Назад к списку
        </Link>
        <Card className="p-5 sm:p-6">
          <Badge className="mb-2 bg-indigo-100 text-indigo-700">{article.category}</Badge>
          <h2 className="mb-1 text-xl font-bold text-gray-900">{article.title}</h2>
          <p className="mb-2 text-xs text-gray-400">{article.date} • v{article.version ?? 1}</p>
          <p className="whitespace-pre-line leading-relaxed text-gray-700">{article.content}</p>

          {canManage ? (
            <div className="mt-4">
              {!editMode ? (
                <button
                  onClick={() => {
                    setEditMode(true);
                    setEditTitle(article.title);
                    setEditCategory(article.category);
                    setEditContent(article.content);
                    setEditStatus(article.status ?? "published");
                  }}
                  className="rounded-lg bg-slate-700 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Редактировать статью
                </button>
              ) : (
                <div className="space-y-2">
                  <input
                    value={editTitle}
                    onChange={(event) => setEditTitle(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                  <input
                    value={editCategory}
                    onChange={(event) => setEditCategory(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                  <textarea
                    rows={6}
                    value={editContent}
                    onChange={(event) => setEditContent(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                  <select
                    value={editStatus}
                    onChange={(event) =>
                      setEditStatus(event.target.value as "draft" | "review" | "published" | "archived")
                    }
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="draft">draft</option>
                    <option value="review">review</option>
                    <option value="published">published</option>
                    <option value="archived">archived</option>
                  </select>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        updateArticle.mutate({
                          id: article.id,
                          title: editTitle,
                          category: editCategory,
                          content: editContent,
                          status: editStatus,
                        });
                        setEditMode(false);
                      }}
                      className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                    >
                      Сохранить
                    </button>
                    <button
                      onClick={() => setEditMode(false)}
                      className="rounded-lg bg-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </Card>

        <Card className="p-4">
          <h3 className="mb-2 font-semibold">Последние версии</h3>
          <div className="space-y-1 text-sm text-gray-600">
            {versions.map((v) => (
              <div key={v.id} className="flex items-center justify-between gap-2 rounded border border-gray-200 bg-white px-2 py-1">
                <p>v{v.version} • {v.status} • {new Date(v.createdAt).toLocaleString()}</p>
                {canManage ? (
                  <button
                    onClick={() => restoreVersion.mutate({ id: article.id, version: v.version })}
                    className="rounded bg-indigo-600 px-2 py-1 text-xs text-white hover:bg-indigo-700"
                  >
                    Восстановить
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  const filtered = data.kbArticles.filter((item) => {
    if (!searchQuery) {
      return true;
    }
    const target = `${item.title} ${item.content}`.toLowerCase();
    return target.includes(searchQuery.toLowerCase());
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">База знаний</h1>

      {canManage ? (
        <Card className="p-4">
          <h2 className="mb-3 font-semibold">Новая статья</h2>
          <div className="space-y-2">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Заголовок"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              placeholder="Категория"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <textarea
              rows={4}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Контент"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <button
              onClick={() => {
                if (!title.trim() || !content.trim()) return;
                createArticle.mutate({
                  title: title.trim(),
                  category: category.trim() || "Общее",
                  content: content.trim(),
                  status: "draft",
                });
                setTitle("");
                setContent("");
              }}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Создать
            </button>
          </div>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {filtered.map((item) => (
          <Card key={item.id} className="p-4 transition-shadow hover:shadow-md">
            <Badge className="mb-2 bg-indigo-100 text-indigo-700">{item.category}</Badge>
            <h3 className="mb-1 font-semibold text-gray-900">{item.title}</h3>
            <p className="line-clamp-2 text-sm text-gray-500">{item.content}</p>
            <div className="mt-1 text-xs text-gray-400">v{item.version ?? 1} • {item.status ?? "published"}</div>
            <div className="mt-3">
              <Link to={`/kb/${item.id}`} className="text-sm text-indigo-600 hover:text-indigo-800">
                Открыть →
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
