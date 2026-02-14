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

export function DocsPage() {
  const { data } = usePortalData();
  const createDocument = useCreateDocumentMutation();
  const submitDocument = useSubmitDocumentMutation();
  const approveDocument = useApproveDocumentMutation();
  const rejectDocument = useRejectDocumentMutation();
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [activeId, setActiveId] = useState<number | null>(null);
  const [comment, setComment] = useState("");

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
          <div className="flex gap-2">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Название документа"
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <button
              onClick={() => {
                if (!title.trim()) {
                  return;
                }
                createDocument.mutate({
                  title: title.trim(),
                  officeId: user.officeId,
                  type: "internal",
                });
                setTitle("");
              }}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Создать
            </button>
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
