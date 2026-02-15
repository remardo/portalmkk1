import { useState } from "react";
import { Calendar, Edit2, Megaphone, Pin, Plus, Save, Trash2, X } from "lucide-react";
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
  const [showCreateForm, setShowCreateForm] = useState(false);
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
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Новости и объявления</h1>
          <p className="mt-1 text-sm text-gray-500">Актуальная информация для сотрудников</p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
          >
            {showCreateForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showCreateForm ? "Отмена" : "Новость"}
          </button>
        )}
      </div>

      {/* Create form */}
      {canCreate && showCreateForm && (
        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-5 py-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100">
              <Megaphone className="h-4 w-4 text-indigo-600" />
            </div>
            <h2 className="font-semibold text-gray-900">Создать новость</h2>
          </div>
          <div className="space-y-4 p-5">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Заголовок новости"
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={4}
              placeholder="Текст новости..."
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
            <button
              onClick={() => {
                if (!title.trim() || !body.trim()) {
                  return;
                }
                createNews.mutate({ title: title.trim(), body: body.trim(), pinned: false });
                setTitle("");
                setBody("");
                setShowCreateForm(false);
              }}
              className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
            >
              Опубликовать
            </button>
          </div>
        </Card>
      )}

      {/* News list */}
      <div className="space-y-4">
        {sorted.map((item) => {
          const isEditing = editingId === item.id;

          return (
            <Card key={item.id} className="overflow-hidden">
              {/* Header */}
              <div className="border-b border-gray-100 px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {item.pinned && (
                        <div className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">
                          <Pin className="h-3 w-3" />
                          Важно
                        </div>
                      )}
                      {item.status && (
                        <Badge variant="default">{item.status}</Badge>
                      )}
                    </div>
                    {!isEditing ? (
                      <h3 className="mt-2 text-lg font-semibold text-gray-900">{item.title}</h3>
                    ) : (
                      <input
                        value={editTitle}
                        onChange={(event) => setEditTitle(event.target.value)}
                        className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-lg font-semibold focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-5">
                {!isEditing ? (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-600">{item.body}</p>
                ) : (
                  <textarea
                    value={editBody}
                    onChange={(event) => setEditBody(event.target.value)}
                    rows={4}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                )}

                {/* Meta */}
                <div className="mt-4 flex items-center gap-3 text-xs text-gray-400">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {item.date}
                  </div>
                  <span className="text-gray-300">•</span>
                  <span>{item.author}</span>
                </div>

                {/* Actions */}
                {canManage && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {!isEditing ? (
                      <button
                        onClick={() => {
                          setEditingId(item.id);
                          setEditTitle(item.title);
                          setEditBody(item.body);
                        }}
                        className="flex items-center gap-1.5 rounded-xl bg-slate-700 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-slate-800"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        Редактировать
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            updateNews.mutate({ id: item.id, title: editTitle, body: editBody });
                            setEditingId(null);
                          }}
                          className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-700"
                        >
                          <Save className="h-3.5 w-3.5" />
                          Сохранить
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="rounded-xl bg-gray-200 px-3 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-300"
                        >
                          Отмена
                        </button>
                      </>
                    )}

                    <button
                      onClick={() => updateNews.mutate({ id: item.id, pinned: !item.pinned })}
                      className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-white transition-colors ${
                        item.pinned
                          ? "bg-gray-500 hover:bg-gray-600"
                          : "bg-amber-500 hover:bg-amber-600"
                      }`}
                    >
                      <Pin className="h-3.5 w-3.5" />
                      {item.pinned ? "Открепить" : "Закрепить"}
                    </button>

                    <button
                      onClick={() => deleteNews.mutate(item.id)}
                      className="flex items-center gap-1.5 rounded-xl bg-red-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-red-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Архивировать
                    </button>
                  </div>
                )}
              </div>
            </Card>
          );
        })}

        {sorted.length === 0 && (
          <Card className="p-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
              <Megaphone className="h-6 w-6 text-gray-400" />
            </div>
            <p className="text-gray-500">Новостей пока нет</p>
          </Card>
        )}
      </div>
    </div>
  );
}
