import { useState } from "react";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { useAuth } from "../contexts/useAuth";
import { portalRepository } from "../services/portalRepository";
import {
  useAdminAuditQuery,
  useAdminCreateUserMutation,
  useAdminUpdateUserMutation,
  usePortalData,
} from "../hooks/usePortalData";
import { canAccessAdmin } from "../lib/permissions";
import { RoleLabels, type Role } from "../domain/models";

const roleOptions: Role[] = ["operator", "office_head", "director", "admin"];

export function AdminPage() {
  const { data } = usePortalData();
  const { user } = useAuth();
  const createUser = useAdminCreateUserMutation();
  const updateUser = useAdminUpdateUserMutation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<Role>("operator");
  const [officeId, setOfficeId] = useState<string>("");
  const [auditAction, setAuditAction] = useState("");
  const [auditActorUserId, setAuditActorUserId] = useState("");
  const [auditLimit, setAuditLimit] = useState("50");
  const [auditEntityType, setAuditEntityType] = useState("");
  const [auditFromDate, setAuditFromDate] = useState("");
  const [auditToDate, setAuditToDate] = useState("");
  const [auditPage, setAuditPage] = useState(1);
  const [isExportingAudit, setIsExportingAudit] = useState(false);
  const pageSize = Number(auditLimit) || 50;
  const audit = useAdminAuditQuery({
    limit: pageSize,
    offset: (auditPage - 1) * pageSize,
    action: auditAction.trim() || undefined,
    actorUserId: auditActorUserId || undefined,
    entityType: auditEntityType.trim() || undefined,
    fromDate: auditFromDate || undefined,
    toDate: auditToDate || undefined,
  });

  const totalPages = Math.max(1, Math.ceil((audit.data?.total ?? 0) / pageSize));

  async function handleExportAudit() {
    setIsExportingAudit(true);
    try {
      const blob = await portalRepository.adminExportAudit({
        limit: 5000,
        action: auditAction.trim() || undefined,
        actorUserId: auditActorUserId || undefined,
        entityType: auditEntityType.trim() || undefined,
        fromDate: auditFromDate || undefined,
        toDate: auditToDate || undefined,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const dateSuffix = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `audit-log-${dateSuffix}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExportingAudit(false);
    }
  }

  if (!user || !data) {
    return null;
  }

  if (!canAccessAdmin(user.role)) {
    return <p className="text-sm text-red-500">Доступ запрещен.</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Админка</h1>

      <Card className="p-4">
        <h2 className="mb-3 font-semibold">Создать пользователя</h2>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <input
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="ФИО"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Пароль"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as Role)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            {roleOptions.map((item) => (
              <option key={item} value={item}>
                {RoleLabels[item]}
              </option>
            ))}
          </select>
          <select
            value={officeId}
            onChange={(event) => setOfficeId(event.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Без офиса</option>
            {data.offices.map((office) => (
              <option key={office.id} value={office.id}>
                {office.name}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => {
            if (!email.trim() || !password.trim() || !fullName.trim()) {
              return;
            }
            createUser.mutate({
              email: email.trim(),
              password: password.trim(),
              fullName: fullName.trim(),
              role,
              officeId: officeId ? Number(officeId) : null,
            });
            setEmail("");
            setPassword("");
            setFullName("");
            setOfficeId("");
            setRole("operator");
          }}
          className="mt-3 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Создать
        </button>
      </Card>

      <div className="space-y-2">
        {data.users.map((item) => (
          <Card key={String(item.id)} className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{item.name}</span>
              <Badge className="bg-gray-100 text-gray-700">{item.email || "без email"}</Badge>
              <Badge className="bg-indigo-100 text-indigo-700">{RoleLabels[item.role]}</Badge>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <select
                value={item.role}
                onChange={(event) =>
                  updateUser.mutate({ id: String(item.id), role: event.target.value as Role })
                }
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
              >
                {roleOptions.map((option) => (
                  <option key={option} value={option}>
                    {RoleLabels[option]}
                  </option>
                ))}
              </select>
              <select
                value={item.officeId || ""}
                onChange={(event) =>
                  updateUser.mutate({
                    id: String(item.id),
                    officeId: event.target.value ? Number(event.target.value) : null,
                  })
                }
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
              >
                <option value="">Без офиса</option>
                {data.offices.map((office) => (
                  <option key={office.id} value={office.id}>
                    {office.name}
                  </option>
                ))}
              </select>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Журнал действий</h2>
          <button
            onClick={() => audit.refetch()}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            Обновить
          </button>
          <button
            onClick={handleExportAudit}
            disabled={isExportingAudit}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isExportingAudit ? "Экспорт..." : "Экспорт CSV"}
          </button>
        </div>

        <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-3">
          <input
            value={auditAction}
            onChange={(event) => {
              setAuditAction(event.target.value);
              setAuditPage(1);
            }}
            placeholder="Фильтр action, например tasks.update"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <select
            value={auditActorUserId}
            onChange={(event) => {
              setAuditActorUserId(event.target.value);
              setAuditPage(1);
            }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Все пользователи</option>
            {data.users.map((item) => (
              <option key={String(item.id)} value={String(item.id)}>
                {item.name}
              </option>
            ))}
          </select>
          <select
            value={auditLimit}
            onChange={(event) => {
              setAuditLimit(event.target.value);
              setAuditPage(1);
            }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="25">25 записей</option>
            <option value="50">50 записей</option>
            <option value="100">100 записей</option>
            <option value="200">200 записей</option>
          </select>
          <input
            value={auditEntityType}
            onChange={(event) => {
              setAuditEntityType(event.target.value);
              setAuditPage(1);
            }}
            placeholder="Сущность, например tasks"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={auditFromDate}
            onChange={(event) => {
              setAuditFromDate(event.target.value);
              setAuditPage(1);
            }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={auditToDate}
            onChange={(event) => {
              setAuditToDate(event.target.value);
              setAuditPage(1);
            }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-2">
          {audit.data?.items.map((row) => (
            <div key={row.id} className="rounded-xl border border-gray-200 p-3 text-xs">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <Badge className="bg-indigo-100 text-indigo-700">{row.action}</Badge>
                <Badge className="bg-gray-100 text-gray-700">{row.entityType}:{row.entityId}</Badge>
                <Badge className="bg-gray-100 text-gray-700">{RoleLabels[row.actorRole]}</Badge>
                <span className="text-gray-500">{new Date(row.createdAt).toLocaleString()}</span>
              </div>
              {row.payload ? (
                <pre className="overflow-x-auto rounded-lg bg-gray-50 p-2 text-[11px] text-gray-600">
                  {JSON.stringify(row.payload, null, 2)}
                </pre>
              ) : null}
            </div>
          ))}
          {!audit.isLoading && (audit.data?.items.length ?? 0) === 0 ? (
            <p className="text-sm text-gray-500">Нет записей по текущему фильтру.</p>
          ) : null}
        </div>

        <div className="mt-3 flex items-center justify-between text-sm text-gray-600">
          <span>
            Всего: {audit.data?.total ?? 0}. Страница {auditPage} из {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAuditPage((prev) => Math.max(1, prev - 1))}
              disabled={auditPage <= 1}
              className="rounded-lg border border-gray-300 px-3 py-1.5 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Назад
            </button>
            <button
              onClick={() => setAuditPage((prev) => (audit.data?.hasMore ? prev + 1 : prev))}
              disabled={!audit.data?.hasMore}
              className="rounded-lg border border-gray-300 px-3 py-1.5 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Вперёд
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
