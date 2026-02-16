import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { useAuth } from "../contexts/useAuth";
import {
  useApproveDocumentMutation,
  useCreateDocumentMutation,
  usePortalData,
  useRejectDocumentMutation,
  useSubmitDocumentMutation,
} from "../hooks/usePortalData";
import { canCreateDocument, canReviewDocument } from "../lib/permissions";
import { statusColors, statusLabels, typeLabels } from "../lib/uiMaps";
import { backendApi } from "../services/apiClient";

export function DocsPage() {
  const queryClient = useQueryClient();
  const { data } = usePortalData();
  const createDocument = useCreateDocumentMutation();
  const submitDocument = useSubmitDocumentMutation();
  const approveDocument = useApproveDocumentMutation();
  const rejectDocument = useRejectDocumentMutation();
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [templateId, setTemplateId] = useState<number | "">("");
  const [approvalRouteId, setApprovalRouteId] = useState<number | "">("");
  const [activeId, setActiveId] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateFolder, setNewTemplateFolder] = useState("Общее");
  const [newTemplateTitle, setNewTemplateTitle] = useState("");
  const [newTemplateBody, setNewTemplateBody] = useState("");
  const [newTemplateInstruction, setNewTemplateInstruction] = useState("");
  const [newRouteName, setNewRouteName] = useState("");
  const [newRouteDescription, setNewRouteDescription] = useState("");
  const [newRouteSteps, setNewRouteSteps] = useState("office_head,director");

  const templatesQuery = useQuery({
    queryKey: ["document-templates"],
    queryFn: () => backendApi.getDocumentTemplates(),
  });

  const routesQuery = useQuery({
    queryKey: ["document-approval-routes"],
    queryFn: () => backendApi.getDocumentApprovalRoutes(),
  });

  const createTemplateMutation = useMutation({
    mutationFn: () =>
      backendApi.createDocumentTemplate({
        name: newTemplateName,
        folder: newTemplateFolder,
        type: "internal",
        titleTemplate: newTemplateTitle,
        bodyTemplate: newTemplateBody || undefined,
        instruction: newTemplateInstruction || undefined,
        defaultRouteId: approvalRouteId === "" ? undefined : Number(approvalRouteId),
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

  const createRouteMutation = useMutation({
    mutationFn: () => {
      const steps = newRouteSteps
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .map((role, idx) => ({
          stepOrder: idx + 1,
          requiredRole: role as "operator" | "office_head" | "director" | "admin",
        }));
      return backendApi.createDocumentApprovalRoute({
        name: newRouteName,
        description: newRouteDescription || undefined,
        steps,
      });
    },
    onSuccess: async () => {
      setNewRouteName("");
      setNewRouteDescription("");
      setNewRouteSteps("office_head,director");
      await queryClient.invalidateQueries({ queryKey: ["document-approval-routes"] });
    },
  });

  const approvalsMap = useMemo(() => {
    if (!data) {
      return new Map<number, Array<{
        id: number;
        documentId: number;
        actorUserId: string;
        actorRole: "operator" | "office_head" | "director" | "admin";
        decision: "submitted" | "approved" | "rejected";
        comment: string | null;
        createdAt: string;
      }>>();
    }
    const map = new Map<number, typeof data.documentApprovals>();
    data.documentApprovals.forEach((item) => {
      const current = map.get(item.documentId) ?? [];
      current.push(item);
      map.set(item.documentId, current);
    });
    return map;
  }, [data]);

  const selectedTemplate = useMemo(
    () => (templatesQuery.data ?? []).find((item) => Number(item.id) === Number(templateId)) ?? null,
    [templateId, templatesQuery.data],
  );

  const templatesByFolder = useMemo(() => {
    const templateItems = templatesQuery.data ?? [];
    const grouped = new Map<string, Array<(typeof templateItems)[number]>>();
    for (const template of templateItems) {
      const folderName = template.folder?.trim() || "Общее";
      const current = grouped.get(folderName) ?? [];
      current.push(template);
      grouped.set(folderName, current);
    }
    return Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0], "ru"));
  }, [templatesQuery.data]);

  if (!data || !user) {
    return null;
  }

  const canCreate = canCreateDocument(user.role);
  const canReview = canReviewDocument(user.role);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Документооборот</h1>

      {canCreate ? (
        <Card className="p-4">
          <h2 className="mb-3 font-semibold">Новый документ</h2>
          <div className="space-y-2">
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
                      if (template.default_route_id) {
                        setApprovalRouteId(Number(template.default_route_id));
                      }
                    }
                  }
                }}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
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
                value={approvalRouteId}
                onChange={(event) => setApprovalRouteId(event.target.value ? Number(event.target.value) : "")}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Маршрут по умолчанию</option>
                {(routesQuery.data ?? []).map((route) => (
                  <option key={route.id} value={route.id}>
                    {route.name}
                  </option>
                ))}
              </select>
            </div>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Название документа"
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Текст документа"
              rows={4}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            {selectedTemplate?.instruction ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <p className="font-medium">Инструкция по шаблону</p>
                <p className="mt-1 whitespace-pre-wrap">{selectedTemplate.instruction}</p>
              </div>
            ) : null}
            <button
              onClick={() => {
                if (!title.trim()) {
                  return;
                }
                createDocument.mutate({
                  title: title.trim(),
                  officeId: user.officeId,
                  type: "internal",
                  body: body.trim() || undefined,
                  templateId: templateId === "" ? undefined : Number(templateId),
                  approvalRouteId: approvalRouteId === "" ? undefined : Number(approvalRouteId),
                });
                setTitle("");
                setBody("");
                setTemplateId("");
                setApprovalRouteId("");
              }}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Создать
            </button>
          </div>
        </Card>
      ) : null}

      {(user.role === "admin" || user.role === "director") ? (
        <Card className="space-y-4 p-4">
          <h2 className="font-semibold">Конфигурация шаблонов и маршрутов</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-2 rounded-lg border border-gray-200 p-3">
              <p className="text-sm font-medium">Новый маршрут согласования</p>
              <input
                value={newRouteName}
                onChange={(event) => setNewRouteName(event.target.value)}
                placeholder="Название маршрута"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <input
                value={newRouteDescription}
                onChange={(event) => setNewRouteDescription(event.target.value)}
                placeholder="Описание"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <input
                value={newRouteSteps}
                onChange={(event) => setNewRouteSteps(event.target.value)}
                placeholder="office_head,director"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <button
                onClick={() => createRouteMutation.mutate()}
                disabled={!newRouteName.trim() || !newRouteSteps.trim() || createRouteMutation.isPending}
                className="rounded-lg bg-slate-700 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                Создать маршрут
              </button>
            </div>
            <div className="space-y-2 rounded-lg border border-gray-200 p-3">
              <p className="text-sm font-medium">Новый шаблон документа</p>
              <input
                value={newTemplateName}
                onChange={(event) => setNewTemplateName(event.target.value)}
                placeholder="Название шаблона"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <input
                value={newTemplateFolder}
                onChange={(event) => setNewTemplateFolder(event.target.value)}
                placeholder="Папка (например: Кадры)"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <input
                value={newTemplateTitle}
                onChange={(event) => setNewTemplateTitle(event.target.value)}
                placeholder="Шаблон заголовка"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <textarea
                value={newTemplateBody}
                onChange={(event) => setNewTemplateBody(event.target.value)}
                placeholder="Шаблон содержимого"
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <textarea
                value={newTemplateInstruction}
                onChange={(event) => setNewTemplateInstruction(event.target.value)}
                placeholder="Инструкция по заполнению шаблона"
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <button
                onClick={() => createTemplateMutation.mutate()}
                disabled={
                  !newTemplateName.trim()
                  || !newTemplateFolder.trim()
                  || !newTemplateTitle.trim()
                  || createTemplateMutation.isPending
                }
                className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                Создать шаблон
              </button>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="space-y-2">
        {data.documents.map((document) => {
          const history = approvalsMap.get(document.id) ?? [];
          return (
            <Card key={document.id} className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-medium text-gray-900">{document.title}</h3>
                <Badge className={statusColors[document.status]}>{statusLabels[document.status]}</Badge>
                <Badge className="bg-gray-100 text-gray-700">{typeLabels[document.type]}</Badge>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                {document.date} • {document.author}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {canCreate && document.status === "draft" ? (
                  <button
                    onClick={() => submitDocument.mutate(document.id)}
                    className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
                  >
                    Отправить на согласование
                  </button>
                ) : null}

                {canReview && document.status === "review" ? (
                  <>
                    <button
                      onClick={() => approveDocument.mutate({ id: document.id, comment })}
                      className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                    >
                      Утвердить
                    </button>
                    <button
                      onClick={() => rejectDocument.mutate({ id: document.id, comment })}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                    >
                      Отклонить
                    </button>
                  </>
                ) : null}

                <button
                  onClick={() => setActiveId(activeId === document.id ? null : document.id)}
                  className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                >
                  {activeId === document.id ? "Скрыть историю" : "Показать историю"}
                </button>
              </div>

              {canReview && document.status === "review" ? (
                <input
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="Комментарий решения"
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              ) : null}

              {activeId === document.id ? (
                <div className="mt-3 space-y-1 rounded-lg border border-gray-200 bg-gray-50 p-2 text-xs text-gray-600">
                  {history.length === 0 ? (
                    <p>История пуста</p>
                  ) : (
                    history.map((row) => (
                      <p key={row.id}>
                        {new Date(row.createdAt).toLocaleString()} • {row.actorRole} • {row.decision}
                        {row.comment ? ` • ${row.comment}` : ""}
                      </p>
                    ))
                  )}
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
