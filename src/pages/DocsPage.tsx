import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { useAuth } from "../contexts/useAuth";
import type { DocumentFolder } from "../domain/models";
import {
  portalDataQueryKey,
  useCreateDocumentMutation,
  usePortalData,
} from "../hooks/usePortalData";
import { canCreateDocument } from "../lib/permissions";
import { statusColors, statusLabels, typeLabels } from "../lib/uiMaps";
import { backendApi } from "../services/apiClient";

type FolderFilter = "all" | "unfiled" | number;

function toBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = reader.result;
      if (typeof value !== "string") {
        reject(new Error("Failed to read file"));
        return;
      }
      const commaIndex = value.indexOf(",");
      resolve(commaIndex >= 0 ? value.slice(commaIndex + 1) : value);
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function formatBytes(size?: number | null) {
  if (!size) return "0 B";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocsPage() {
  const queryClient = useQueryClient();
  const { data } = usePortalData();
  const { user } = useAuth();
  const createDocument = useCreateDocumentMutation();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [templateId, setTemplateId] = useState<number | "">("");
  const [selectedFolder, setSelectedFolder] = useState<FolderFilter>("all");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [selectedOfficeId, setSelectedOfficeId] = useState<number | "">("");

  const [newFolderName, setNewFolderName] = useState("");
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateFolder, setNewTemplateFolder] = useState("Общее");
  const [newTemplateTitle, setNewTemplateTitle] = useState("");
  const [newTemplateBody, setNewTemplateBody] = useState("");
  const [newTemplateInstruction, setNewTemplateInstruction] = useState("");

  const templatesQuery = useQuery({
    queryKey: ["document-templates"],
    queryFn: () => backendApi.getDocumentTemplates(),
  });
  const createFolderMutation = useMutation({
    mutationFn: () =>
      backendApi.createDocumentFolder({
        name: newFolderName.trim(),
        parentId: typeof selectedFolder === "number" ? selectedFolder : null,
      }),
    onSuccess: async () => {
      setNewFolderName("");
      await queryClient.invalidateQueries({ queryKey: portalDataQueryKey });
    },
  });

  const createTemplateMutation = useMutation({
    mutationFn: () =>
      backendApi.createDocumentTemplate({
        name: newTemplateName.trim(),
        folder: newTemplateFolder.trim(),
        type: "internal",
        titleTemplate: newTemplateTitle.trim(),
        bodyTemplate: newTemplateBody || undefined,
        instruction: newTemplateInstruction || undefined,
        status: "approved",
      }),
    onSuccess: async () => {
      setNewTemplateName("");
      setNewTemplateFolder("Общее");
      setNewTemplateTitle("");
      setNewTemplateBody("");
      setNewTemplateInstruction("");
      await queryClient.invalidateQueries({ queryKey: ["document-templates"] });
    },
  });

  const templatesByFolder = useMemo(() => {
    const items = templatesQuery.data ?? [];
    const grouped = new Map<string, Array<(typeof items)[number]>>();
    for (const item of items) {
      const folder = item.folder?.trim() || "Общее";
      const current = grouped.get(folder) ?? [];
      current.push(item);
      grouped.set(folder, current);
    }
    return Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0], "ru"));
  }, [templatesQuery.data]);

  const selectedTemplate = useMemo(
    () => (templatesQuery.data ?? []).find((item) => Number(item.id) === Number(templateId)) ?? null,
    [templateId, templatesQuery.data],
  );

  const folderById = useMemo(() => {
    const map = new Map<number, DocumentFolder>();
    for (const folder of data?.documentFolders ?? []) {
      map.set(folder.id, folder);
    }
    return map;
  }, [data?.documentFolders]);

  const folderTree = useMemo(() => {
    const children = new Map<number | null, DocumentFolder[]>();
    for (const folder of data?.documentFolders ?? []) {
      const key = folder.parentId ?? null;
      const current = children.get(key) ?? [];
      current.push(folder);
      children.set(key, current);
    }
    for (const list of children.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name, "ru"));
    }

    const ordered: Array<{ folder: DocumentFolder; depth: number }> = [];
    const walk = (parentId: number | null, depth: number) => {
      for (const child of children.get(parentId) ?? []) {
        ordered.push({ folder: child, depth });
        walk(child.id, depth + 1);
      }
    };
    walk(null, 0);
    return ordered;
  }, [data?.documentFolders]);

  const filteredDocuments = useMemo(() => {
    const documents = data?.documents ?? [];
    if (selectedFolder === "all") return documents;
    if (selectedFolder === "unfiled") return documents.filter((doc) => !doc.folderId);
    return documents.filter((doc) => Number(doc.folderId) === selectedFolder);
  }, [data?.documents, selectedFolder]);

  const selectedFolderPath = useMemo(() => {
    if (typeof selectedFolder !== "number") return [];
    const chain: DocumentFolder[] = [];
    let current = folderById.get(selectedFolder);
    while (current) {
      chain.unshift(current);
      current = current.parentId ? folderById.get(current.parentId) : undefined;
    }
    return chain;
  }, [selectedFolder, folderById]);

  const canCreate = user ? canCreateDocument(user.role) : false;
  if (!data || !user) return null;

  async function handleCreateDocument() {
    if (!title.trim()) return;

    const resolvedOfficeId =
      selectedOfficeId === ""
        ? (user?.officeId || data?.offices[0]?.id)
        : Number(selectedOfficeId);
    if (!resolvedOfficeId) return;

    let fileDataBase64: string | undefined;
    if (selectedFile) {
      fileDataBase64 = await toBase64(selectedFile);
    }

    createDocument.mutate({
      title: title.trim(),
      officeId: resolvedOfficeId,
      folderId: typeof selectedFolder === "number" ? selectedFolder : undefined,
      type: "internal",
      body: body.trim() || undefined,
      templateId: templateId === "" ? undefined : Number(templateId),
      fileName: selectedFile?.name,
      mimeType: selectedFile?.type,
      fileDataBase64,
    });

    setTitle("");
    setBody("");
    setTemplateId("");
    setSelectedFile(null);
    setFileInputKey((value) => value + 1);
  }

  async function handleDownload(documentId: number, fallbackName: string) {
    const blob = await backendApi.downloadDocumentFile(documentId);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fallbackName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Документооборот</h1>

      {canCreate ? (
        <Card className="space-y-3 border-slate-200 bg-slate-50 p-4">
          <p className="font-semibold text-slate-900">Новый документ</p>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <select
              value={templateId}
              onChange={(event) => {
                const value = event.target.value ? Number(event.target.value) : "";
                setTemplateId(value);
                if (value !== "") {
                  const template = (templatesQuery.data ?? []).find((item) => Number(item.id) === value);
                  if (template) {
                    setTitle(template.title_template);
                    setBody(template.body_template ?? "");
                  }
                }
              }}
              className="rounded border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Без шаблона</option>
              {templatesByFolder.map(([folderName, templates]) => (
                <optgroup key={folderName} label={folderName}>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <select
              value={selectedOfficeId}
              onChange={(event) => setSelectedOfficeId(event.target.value ? Number(event.target.value) : "")}
              className="rounded border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Офис по умолчанию</option>
              {data.offices.map((office) => (
                <option key={office.id} value={office.id}>
                  {office.name}
                </option>
              ))}
            </select>
          </div>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Название документа"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Текст документа"
            rows={4}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <input
              key={fileInputKey}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,application/pdf,application/msword,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
              className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
            />
            <button
              onClick={() => void handleCreateDocument()}
              disabled={!title.trim() || createDocument.isPending}
              className="rounded bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
            >
              Сохранить документ
            </button>
          </div>
          {selectedTemplate?.instruction ? (
            <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <p className="font-medium">Инструкция по шаблону</p>
              <p className="mt-1 whitespace-pre-wrap">{selectedTemplate.instruction}</p>
            </div>
          ) : null}
        </Card>
      ) : null}

      <Card className="overflow-hidden p-0">
        <div className="grid min-h-[520px] grid-cols-1 md:grid-cols-[280px_1fr]">
          <aside className="border-r border-slate-200 bg-slate-100 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Папки</p>
            <div className="space-y-1 text-sm">
              <button
                onClick={() => setSelectedFolder("all")}
                className={`w-full rounded px-2 py-1.5 text-left ${selectedFolder === "all" ? "bg-blue-700 text-white" : "hover:bg-slate-200"}`}
              >
                Все документы
              </button>
              <button
                onClick={() => setSelectedFolder("unfiled")}
                className={`w-full rounded px-2 py-1.5 text-left ${selectedFolder === "unfiled" ? "bg-blue-700 text-white" : "hover:bg-slate-200"}`}
              >
                Без папки
              </button>
              {folderTree.map(({ folder, depth }) => (
                <button
                  key={folder.id}
                  onClick={() => setSelectedFolder(folder.id)}
                  className={`w-full rounded px-2 py-1.5 text-left ${selectedFolder === folder.id ? "bg-blue-700 text-white" : "hover:bg-slate-200"}`}
                  style={{ paddingLeft: 8 + depth * 16 }}
                >
                  {folder.name}
                </button>
              ))}
            </div>
            {canCreate ? (
              <div className="mt-4 space-y-2 border-t border-slate-200 pt-3">
                <input
                  value={newFolderName}
                  onChange={(event) => setNewFolderName(event.target.value)}
                  placeholder="Новая папка"
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                />
                <button
                  onClick={() => createFolderMutation.mutate()}
                  disabled={!newFolderName.trim() || createFolderMutation.isPending}
                  className="w-full rounded bg-slate-800 px-2 py-1.5 text-xs font-medium text-white hover:bg-slate-900 disabled:opacity-60"
                >
                  Создать папку
                </button>
              </div>
            ) : null}
          </aside>

          <section className="space-y-3 p-3">
            <div className="rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
              {selectedFolderPath.length > 0 ? (
                <span>Путь: {selectedFolderPath.map((item) => item.name).join(" / ")}</span>
              ) : selectedFolder === "unfiled" ? (
                <span>Путь: Без папки</span>
              ) : (
                <span>Путь: Все документы</span>
              )}
            </div>

            <div className="overflow-x-auto rounded border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100 text-left text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Название</th>
                    <th className="px-3 py-2">Автор</th>
                    <th className="px-3 py-2">Дата</th>
                    <th className="px-3 py-2">Статус</th>
                    <th className="px-3 py-2">Файл</th>
                    <th className="px-3 py-2">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocuments.map((document) => (
                    <tr key={document.id} className="border-t border-slate-200 hover:bg-slate-50">
                      <td className="px-3 py-2">
                        <span className="font-medium text-slate-900">{document.title}</span>
                        <div className="mt-1 text-xs text-slate-500">{typeLabels[document.type]}</div>
                      </td>
                      <td className="px-3 py-2">{document.author}</td>
                      <td className="px-3 py-2">{document.date}</td>
                      <td className="px-3 py-2">
                        <Badge className={statusColors[document.status]}>{statusLabels[document.status]}</Badge>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600">
                        {document.fileName ? `${document.fileName} (${formatBytes(document.fileSizeBytes)})` : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {document.fileName ? (
                            <button
                              onClick={() => void handleDownload(document.id, document.fileName ?? `document-${document.id}`)}
                              className="rounded bg-slate-700 px-2 py-1 text-xs text-white hover:bg-slate-800"
                            >
                              Скачать
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredDocuments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-10 text-center text-slate-500">
                        Документы не найдены
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </Card>

      {(user.role === "admin" || user.role === "director") ? (
        <Card className="space-y-4 p-4">
          <h2 className="font-semibold">Конфигурация шаблонов</h2>
          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-2 rounded-lg border border-gray-200 p-3">
              <p className="text-sm font-medium">Новый шаблон документа</p>
              <input
                value={newTemplateName}
                onChange={(event) => setNewTemplateName(event.target.value)}
                placeholder="Название шаблона"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
              <input
                value={newTemplateFolder}
                onChange={(event) => setNewTemplateFolder(event.target.value)}
                placeholder="Папка"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
              <input
                value={newTemplateTitle}
                onChange={(event) => setNewTemplateTitle(event.target.value)}
                placeholder="Шаблон заголовка"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
              <textarea
                value={newTemplateBody}
                onChange={(event) => setNewTemplateBody(event.target.value)}
                placeholder="Шаблон содержимого"
                rows={3}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
              <textarea
                value={newTemplateInstruction}
                onChange={(event) => setNewTemplateInstruction(event.target.value)}
                placeholder="Инструкция по заполнению шаблона"
                rows={3}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
              <button
                onClick={() => createTemplateMutation.mutate()}
                disabled={!newTemplateName.trim() || !newTemplateFolder.trim() || !newTemplateTitle.trim() || createTemplateMutation.isPending}
                className="rounded bg-blue-700 px-3 py-2 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-60"
              >
                Создать шаблон
              </button>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
