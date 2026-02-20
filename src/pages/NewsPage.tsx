import { type ReactNode, type RefObject, useMemo, useRef, useState } from "react";
import { Calendar, Edit2, ImagePlus, Loader2, Megaphone, Pin, Plus, Save, Trash2, X } from "lucide-react";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import {
  useCreateNewsMutation,
  useDeleteNewsMutation,
  usePortalData,
  useUploadNewsImageMutation,
  useUpdateNewsMutation,
} from "../hooks/usePortalData";
import { useAuth } from "../contexts/useAuth";
import { canCreateNews, canManageNews } from "../lib/permissions";
import type { NewsImage } from "../domain/models";

const NEWS_IMAGE_TOKEN_REGEX = /\{\{news-image:(\d+)\}\}/g;

function toBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const base64 = result.replace(/^data:[^;]+;base64,/, "");
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
    reader.readAsDataURL(file);
  });
}

function readImageDimensions(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result ?? "");
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Не удалось открыть изображение"));
      image.src = src;
    };
    reader.onerror = () => reject(new Error("Не удалось прочитать изображение"));
    reader.readAsDataURL(file);
  });
}

async function compressNewsImage(file: File): Promise<{ base64: string; mimeType: string }> {
  if (file.type === "image/gif") {
    return { base64: await toBase64(file), mimeType: "image/gif" };
  }

  const image = await readImageDimensions(file);
  const maxSide = 1400;
  const ratio = Math.min(1, maxSide / Math.max(image.width, image.height));
  const targetWidth = Math.max(1, Math.round(image.width * ratio));
  const targetHeight = Math.max(1, Math.round(image.height * ratio));

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return { base64: await toBase64(file), mimeType: file.type || "image/png" };
  }
  ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

  const mimeType = "image/webp";
  let quality = 0.86;
  let blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, mimeType, quality));
  while (blob && blob.size > 2.8 * 1024 * 1024 && quality > 0.5) {
    quality -= 0.08;
    blob = await new Promise((resolve) => canvas.toBlob(resolve, mimeType, quality));
  }

  if (!blob) {
    return { base64: await toBase64(file), mimeType: file.type || "image/png" };
  }

  return { base64: await toBase64(new File([blob], "news-image.webp", { type: mimeType })), mimeType };
}

function buildImageSrc(image: { imageDataBase64: string; imageMimeType: string } | { base64: string; mimeType: string }) {
  if ("imageDataBase64" in image) {
    return `data:${image.imageMimeType};base64,${image.imageDataBase64}`;
  }
  return `data:${image.mimeType};base64,${image.base64}`;
}

function renderNewsBody(body: string, imageById: Map<number, NewsImage>) {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  NEWS_IMAGE_TOKEN_REGEX.lastIndex = 0;
  while ((match = NEWS_IMAGE_TOKEN_REGEX.exec(body)) !== null) {
    const [token, idRaw] = match;
    const matchStart = match.index;

    if (matchStart > lastIndex) {
      const textPart = body.slice(lastIndex, matchStart).trim();
      if (textPart.length > 0) {
        nodes.push(
          <p key={`text-${key++}`} className="whitespace-pre-wrap text-sm leading-relaxed text-gray-600">
            {textPart}
          </p>,
        );
      }
    }

    const imageId = Number(idRaw);
    const image = imageById.get(imageId);
    if (image) {
      nodes.push(
        <figure key={`img-${key++}`} className="overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
          <img
            src={buildImageSrc({ imageDataBase64: image.imageDataBase64, imageMimeType: image.imageMimeType })}
            alt={image.caption ?? `Изображение новости #${image.id}`}
            className="max-h-96 w-full object-cover"
            loading="lazy"
          />
          {image.caption && <figcaption className="px-3 py-2 text-xs text-gray-500">{image.caption}</figcaption>}
        </figure>,
      );
    } else {
      nodes.push(
        <p key={`missing-${key++}`} className="text-xs text-amber-600">
          {`Изображение ${token} не найдено`}
        </p>,
      );
    }

    lastIndex = matchStart + token.length;
  }

  if (lastIndex < body.length) {
    const tail = body.slice(lastIndex).trim();
    if (tail.length > 0) {
      nodes.push(
        <p key={`text-${key++}`} className="whitespace-pre-wrap text-sm leading-relaxed text-gray-600">
          {tail}
        </p>,
      );
    }
  }

  if (nodes.length === 0) {
    return <p className="text-sm text-gray-500">Пустой текст новости</p>;
  }
  return <div className="space-y-3">{nodes}</div>;
}

export function NewsPage() {
  const { data } = usePortalData();
  const createNews = useCreateNewsMutation();
  const updateNews = useUpdateNewsMutation();
  const deleteNews = useDeleteNewsMutation();
  const uploadNewsImage = useUploadNewsImageMutation();
  const { user } = useAuth();
  const canCreate = user ? canCreateNews(user.role) : false;
  const canManage = user ? canManageNews(user.role) : false;

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [coverImageDataBase64, setCoverImageDataBase64] = useState<string | undefined>(undefined);
  const [coverImageMimeType, setCoverImageMimeType] = useState<string | undefined>(undefined);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editCoverImageDataBase64, setEditCoverImageDataBase64] = useState<string | null | undefined>(undefined);
  const [editCoverImageMimeType, setEditCoverImageMimeType] = useState<string | null | undefined>(undefined);
  const [createUploadError, setCreateUploadError] = useState("");
  const [editUploadError, setEditUploadError] = useState("");
  const [isUploadingCreateInlineImage, setIsUploadingCreateInlineImage] = useState(false);
  const [isUploadingEditInlineImage, setIsUploadingEditInlineImage] = useState(false);
  const createBodyRef = useRef<HTMLTextAreaElement | null>(null);
  const editBodyRef = useRef<HTMLTextAreaElement | null>(null);
  const newsImageById = useMemo(() => new Map((data?.newsImages ?? []).map((image) => [image.id, image])), [data?.newsImages]);

  if (!data || !user) {
    return null;
  }

  const insertAtCursor = (
    currentValue: string,
    setValue: (value: string) => void,
    textareaRef: RefObject<HTMLTextAreaElement | null>,
    insertedText: string,
  ) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setValue(`${currentValue}\n${insertedText}`);
      return;
    }

    const start = textarea.selectionStart ?? currentValue.length;
    const end = textarea.selectionEnd ?? currentValue.length;
    const nextValue = `${currentValue.slice(0, start)}${insertedText}${currentValue.slice(end)}`;
    setValue(nextValue);
    const nextPosition = start + insertedText.length;
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextPosition, nextPosition);
    });
  };

  const uploadInlineImage = async (file: File, target: "create" | "edit", newsId?: number) => {
    const compressed = await compressNewsImage(file);
    const result = await uploadNewsImage.mutateAsync({
      newsId,
      imageDataBase64: compressed.base64,
      imageMimeType: compressed.mimeType,
      caption: file.name,
    });
    const token = `\n${result.token}\n`;

    if (target === "create") {
      insertAtCursor(body, setBody, createBodyRef, token);
    } else {
      insertAtCursor(editBody, setEditBody, editBodyRef, token);
    }
  };

  const onCreateInlineImageSelected = async (file?: File) => {
    if (!file) return;
    try {
      setCreateUploadError("");
      setIsUploadingCreateInlineImage(true);
      await uploadInlineImage(file, "create");
    } catch (error) {
      setCreateUploadError(error instanceof Error ? error.message : "Не удалось загрузить изображение");
    } finally {
      setIsUploadingCreateInlineImage(false);
    }
  };

  const onEditInlineImageSelected = async (file?: File) => {
    if (!file || editingId === null) return;
    try {
      setEditUploadError("");
      setIsUploadingEditInlineImage(true);
      await uploadInlineImage(file, "edit", editingId);
    } catch (error) {
      setEditUploadError(error instanceof Error ? error.message : "Не удалось загрузить изображение");
    } finally {
      setIsUploadingEditInlineImage(false);
    }
  };

  const onCreateCoverImageSelected = async (file?: File) => {
    if (!file) return;
    try {
      const compressed = await compressNewsImage(file);
      setCoverImageDataBase64(compressed.base64);
      setCoverImageMimeType(compressed.mimeType);
    } catch {
      setCreateUploadError("Не удалось подготовить обложку");
    }
  };

  const onEditCoverImageSelected = async (file?: File) => {
    if (!file) return;
    try {
      const compressed = await compressNewsImage(file);
      setEditCoverImageDataBase64(compressed.base64);
      setEditCoverImageMimeType(compressed.mimeType);
    } catch {
      setEditUploadError("Не удалось подготовить обложку");
    }
  };

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
            className="flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-700"
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
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-100">
              <Megaphone className="h-4 w-4 text-teal-600" />
            </div>
            <h2 className="font-semibold text-gray-900">Создать новость</h2>
          </div>
          <div className="space-y-4 p-5">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Заголовок новости"
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-100"
            />
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              ref={createBodyRef}
              rows={4}
              placeholder="Текст новости..."
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-100"
            />
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">
                  <ImagePlus className="h-4 w-4" />
                  Вставить фото в текст
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => onCreateInlineImageSelected(event.target.files?.[0])}
                  />
                </label>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">
                  <ImagePlus className="h-4 w-4" />
                  Загрузить обложку
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => onCreateCoverImageSelected(event.target.files?.[0])}
                  />
                </label>
                {isUploadingCreateInlineImage && (
                  <span className="inline-flex items-center gap-1 text-xs text-teal-600">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Загрузка фото...
                  </span>
                )}
              </div>
              {coverImageDataBase64 && coverImageMimeType && (
                <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                  <img
                    src={buildImageSrc({ base64: coverImageDataBase64, mimeType: coverImageMimeType })}
                    alt="Обложка новости"
                    className="max-h-64 w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setCoverImageDataBase64(undefined);
                      setCoverImageMimeType(undefined);
                    }}
                    className="absolute right-2 top-2 rounded-lg bg-black/60 px-2 py-1 text-xs font-medium text-white hover:bg-black/70"
                  >
                    Удалить обложку
                  </button>
                </div>
              )}
              {createUploadError && <p className="text-xs text-red-600">{createUploadError}</p>}
            </div>
            <button
              onClick={() => {
                if (!title.trim() || !body.trim()) {
                  return;
                }
                createNews.mutate({
                  title: title.trim(),
                  body: body.trim(),
                  pinned: false,
                  coverImageDataBase64,
                  coverImageMimeType,
                });
                setTitle("");
                setBody("");
                setCoverImageDataBase64(undefined);
                setCoverImageMimeType(undefined);
                setCreateUploadError("");
                setShowCreateForm(false);
              }}
              disabled={createNews.isPending || isUploadingCreateInlineImage}
              className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-700"
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
                        className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-lg font-semibold focus:border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-100"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-5">
                {!isEditing && item.coverImageDataBase64 && item.coverImageMimeType && (
                  <div className="mb-4 overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
                    <img
                      src={buildImageSrc({
                        imageDataBase64: item.coverImageDataBase64,
                        imageMimeType: item.coverImageMimeType,
                      })}
                      alt={`Обложка: ${item.title}`}
                      className="max-h-80 w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                )}
                {!isEditing ? (
                  renderNewsBody(item.body, newsImageById)
                ) : (
                  <div className="space-y-3">
                    <textarea
                      value={editBody}
                      onChange={(event) => setEditBody(event.target.value)}
                      ref={editBodyRef}
                      rows={5}
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-100"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">
                        <ImagePlus className="h-4 w-4" />
                        Вставить фото в текст
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event) => onEditInlineImageSelected(event.target.files?.[0])}
                        />
                      </label>
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">
                        <ImagePlus className="h-4 w-4" />
                        Загрузить обложку
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event) => onEditCoverImageSelected(event.target.files?.[0])}
                        />
                      </label>
                      {isUploadingEditInlineImage && (
                        <span className="inline-flex items-center gap-1 text-xs text-teal-600">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Загрузка фото...
                        </span>
                      )}
                    </div>
                    {editCoverImageDataBase64 && editCoverImageMimeType && (
                      <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                        <img
                          src={buildImageSrc({
                            base64: editCoverImageDataBase64,
                            mimeType: editCoverImageMimeType,
                          })}
                          alt="Новая обложка новости"
                          className="max-h-64 w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setEditCoverImageDataBase64(null);
                            setEditCoverImageMimeType(null);
                          }}
                          className="absolute right-2 top-2 rounded-lg bg-black/60 px-2 py-1 text-xs font-medium text-white hover:bg-black/70"
                        >
                          Убрать обложку
                        </button>
                      </div>
                    )}
                    {editUploadError && <p className="text-xs text-red-600">{editUploadError}</p>}
                  </div>
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
                          setEditCoverImageDataBase64(item.coverImageDataBase64 ?? null);
                          setEditCoverImageMimeType(item.coverImageMimeType ?? null);
                          setEditUploadError("");
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
                            updateNews.mutate({
                              id: item.id,
                              title: editTitle.trim(),
                              body: editBody.trim(),
                              coverImageDataBase64: editCoverImageDataBase64,
                              coverImageMimeType: editCoverImageMimeType,
                            });
                            setEditingId(null);
                          }}
                          disabled={updateNews.isPending || isUploadingEditInlineImage}
                          className="flex items-center gap-1.5 rounded-xl bg-teal-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-teal-700"
                        >
                          <Save className="h-3.5 w-3.5" />
                          Сохранить
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(null);
                            setEditUploadError("");
                          }}
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

