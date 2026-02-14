import { useState } from "react";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import {
  useCreateNewsMutation,
  useDeleteNewsMutation,
  usePortalData,
  useUpdateNewsMutation,
} from "../hooks/usePortalData";
import { useAuth } from "../contexts/useAuth";
import { canCreateNews, canManageNews } from "../lib/permissions";

export function NewsPage() {
  const { data } = usePortalData();
  const createNews = useCreateNewsMutation();
  const updateNews = useUpdateNewsMutation();
  const deleteNews = useDeleteNewsMutation();
  const { user } = useAuth();
  const canCreate = user ? canCreateNews(user.role) : false;
  const canManage = user ? canManageNews(user.role) : false;

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");

  if (!data || !user) {
    return null;
  }

  const sorted = [...data.news]
    .filter((item) => item.status !== "archived")
    .sort((a, b) => {
      if (a.pinned !== b.pinned) {
        return a.pinned ? -1 : 1;
      }
      return b.date.localeCompare(a.date);
    });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Новости и объявления</h1>

      {canCreate ? (
        <Card className="p-4">
          <h2 className="mb-3 font-semibold">Создать новость</h2>
          <div className="space-y-2">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Заголовок"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={3}
              placeholder="Текст"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <button
              onClick={() => {
                if (!title.trim() || !body.trim()) {
                  return;
                }
                createNews.mutate({ title: title.trim(), body: body.trim(), pinned: false });
                setTitle("");
                setBody("");
              }}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Опубликовать
            </button>
          </div>
        </Card>
      ) : null}

      <div className="space-y-4">
        {sorted.map((item) => {
          const isEditing = editingId === item.id;
          return (
            <Card key={item.id} className="p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-gray-900">{item.title}</h3>
                {item.pinned ? <Badge className="bg-red-100 text-red-700">Важно</Badge> : null}
                {item.status ? <Badge className="bg-gray-100 text-gray-700">{item.status}</Badge> : null}
              </div>

              {!isEditing ? (
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{item.body}</p>
              ) : (
                <div className="mt-2 space-y-2">
                  <input
                    value={editTitle}
                    onChange={(event) => setEditTitle(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                  <textarea
                    rows={3}
                    value={editBody}
                    onChange={(event) => setEditBody(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
              )}

              <div className="mt-3 flex items-center gap-3 text-xs text-gray-400">
                <span>{item.date}</span>
                <span>•</span>
                <span>{item.author}</span>
              </div>

              {canManage ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {!isEditing ? (
                    <button
                      onClick={() => {
                        setEditingId(item.id);
                        setEditTitle(item.title);
                        setEditBody(item.body);
                      }}
                      className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                    >
                      Редактировать
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          updateNews.mutate({ id: item.id, title: editTitle, body: editBody });
                          setEditingId(null);
                        }}
                        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                      >
                        Сохранить
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="rounded-lg bg-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-300"
                      >
                        Отмена
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => updateNews.mutate({ id: item.id, pinned: !item.pinned })}
                    className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600"
                  >
                    {item.pinned ? "Открепить" : "Закрепить"}
                  </button>

                  <button
                    onClick={() => deleteNews.mutate(item.id)}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                  >
                    Архивировать
                  </button>
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>
    </div>
  );
}