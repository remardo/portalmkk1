import { useState } from "react";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { useAuth } from "../contexts/useAuth";
import { portalRepository } from "../services/portalRepository";
import {
  useAdminAuditQuery,
  useAdminCreateUserMutation,
  useAdminUpdateOfficeMutation,
  useAdminUpdateUserMutation,
  usePortalData,
} from "../hooks/usePortalData";
import { canAccessAdmin } from "../lib/permissions";
import { RoleLabels, type Office, type Role, type User } from "../domain/models";

const roleOptions: Role[] = ["operator", "office_head", "director", "admin"];
type ToastItem = { id: number; kind: "success" | "error"; message: string };

export function AdminPage() {
  const { data } = usePortalData();
  const { user } = useAuth();
  const createUser = useAdminCreateUserMutation();
  const updateUser = useAdminUpdateUserMutation();
  const updateOffice = useAdminUpdateOfficeMutation();

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
  const [userDrafts, setUserDrafts] = useState<
    Record<string, { fullName: string; email: string; role: Role; officeId: string; phone: string; position: string }>
  >({});
  const [userPasswordDrafts, setUserPasswordDrafts] = useState<Record<string, string>>({});
  const [officeDrafts, setOfficeDrafts] = useState<
    Record<number, { name: string; city: string; address: string; rating: string; headId: string }>
  >({});
  const [toasts, setToasts] = useState<ToastItem[]>([]);
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

  function extractErrorMessage(error: unknown) {
    if (error instanceof Error && error.message) return error.message;
    return "Операция не выполнена";
  }

  function showToast(kind: ToastItem["kind"], message: string) {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 3500);
  }

  function generateTempPassword() {
    return `Tmp#${Math.random().toString(36).slice(2, 8)}${Date.now().toString().slice(-4)}`;
  }

  function generateResetLogin(userId: string | number) {
    const compact = String(userId).replace(/[^a-zA-Z0-9]/g, "").slice(0, 10).toLowerCase() || "user";
    return `reset.${compact}.${Date.now().toString().slice(-5)}@portal.local`;
  }

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

  function getUserDraft(item: User) {
    return (
      userDrafts[String(item.id)] ?? {
        fullName: item.name,
        email: item.email ?? "",
        role: item.role,
        officeId: item.officeId ? String(item.officeId) : "",
        phone: item.phone ?? "",
        position: item.position ?? "",
      }
    );
  }

  function getOfficeDraft(item: Office) {
    return (
      officeDrafts[item.id] ?? {
        name: item.name,
        city: item.city,
        address: item.address,
        rating: String(item.rating ?? 0),
        headId: item.headId ? String(item.headId) : "",
      }
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Админка</h1>
      <div className="fixed right-4 top-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`max-w-sm rounded-lg px-3 py-2 text-sm text-white shadow-lg ${
              toast.kind === "success" ? "bg-emerald-600" : "bg-rose-600"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>

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
          onClick={async () => {
            if (!email.trim() || !password.trim() || !fullName.trim()) {
              showToast("error", "Заполните ФИО, email и пароль");
              return;
            }
            try {
              await createUser.mutateAsync({
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
              showToast("success", "Сотрудник создан");
            } catch (error) {
              showToast("error", extractErrorMessage(error));
            }
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
              <span className="font-medium">Сотрудник</span>
              <Badge className="bg-gray-100 text-gray-700">{item.email || "без email"}</Badge>
              <Badge className="bg-indigo-100 text-indigo-700">{RoleLabels[item.role]}</Badge>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
              <input
                value={getUserDraft(item).fullName}
                onChange={(event) =>
                  setUserDrafts((prev) => ({
                    ...prev,
                    [String(item.id)]: { ...getUserDraft(item), fullName: event.target.value },
                  }))
                }
                placeholder="ФИО"
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
              />
              <input
                value={getUserDraft(item).email}
                onChange={(event) =>
                  setUserDrafts((prev) => ({
                    ...prev,
                    [String(item.id)]: { ...getUserDraft(item), email: event.target.value },
                  }))
                }
                placeholder="Логин (email)"
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
              />
              <input
                value={getUserDraft(item).phone}
                onChange={(event) =>
                  setUserDrafts((prev) => ({
                    ...prev,
                    [String(item.id)]: { ...getUserDraft(item), phone: event.target.value },
                  }))
                }
                placeholder="Телефон"
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
              />
              <input
                value={getUserDraft(item).position}
                onChange={(event) =>
                  setUserDrafts((prev) => ({
                    ...prev,
                    [String(item.id)]: { ...getUserDraft(item), position: event.target.value },
                  }))
                }
                placeholder="Должность"
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
              />
              <select
                value={getUserDraft(item).role}
                onChange={(event) =>
                  setUserDrafts((prev) => ({
                    ...prev,
                    [String(item.id)]: { ...getUserDraft(item), role: event.target.value as Role },
                  }))
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
                value={getUserDraft(item).officeId}
                onChange={(event) =>
                  setUserDrafts((prev) => ({
                    ...prev,
                    [String(item.id)]: { ...getUserDraft(item), officeId: event.target.value },
                  }))
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
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onClick={async () => {
                  try {
                    await updateUser.mutateAsync({
                      id: String(item.id),
                      fullName: getUserDraft(item).fullName.trim(),
                      email: getUserDraft(item).email.trim(),
                      phone: getUserDraft(item).phone.trim(),
                      position: getUserDraft(item).position.trim(),
                      role: getUserDraft(item).role,
                      officeId: getUserDraft(item).officeId ? Number(getUserDraft(item).officeId) : null,
                    });
                    showToast("success", `Данные сотрудника ${item.name} сохранены`);
                  } catch (error) {
                    showToast("error", extractErrorMessage(error));
                  }
                }}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Сохранить сотрудника
              </button>
              <button
                onClick={async () => {
                  const nextLogin = generateResetLogin(item.id);
                  try {
                    await updateUser.mutateAsync({
                      id: String(item.id),
                      email: nextLogin,
                    });
                    setUserDrafts((prev) => ({
                      ...prev,
                      [String(item.id)]: { ...getUserDraft(item), email: nextLogin },
                    }));
                    showToast("success", `Логин сброшен: ${nextLogin}`);
                  } catch (error) {
                    showToast("error", extractErrorMessage(error));
                  }
                }}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
              >
                Сбросить логин
              </button>
              <input
                type="password"
                value={userPasswordDrafts[String(item.id)] ?? ""}
                onChange={(event) =>
                  setUserPasswordDrafts((prev) => ({ ...prev, [String(item.id)]: event.target.value }))
                }
                placeholder="Новый пароль (мин. 8)"
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
              />
              <button
                onClick={async () => {
                  const nextPassword = (userPasswordDrafts[String(item.id)] ?? "").trim();
                  if (nextPassword.length < 8) {
                    showToast("error", "Пароль должен быть не короче 8 символов");
                    return;
                  }
                  try {
                    await updateUser.mutateAsync({
                      id: String(item.id),
                      password: nextPassword,
                    });
                    setUserPasswordDrafts((prev) => ({ ...prev, [String(item.id)]: "" }));
                    showToast("success", `Пароль для ${item.name} обновлен`);
                  } catch (error) {
                    showToast("error", extractErrorMessage(error));
                  }
                }}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
              >
                Сбросить пароль
              </button>
              <button
                onClick={async () => {
                  const generated = generateTempPassword();
                  try {
                    await updateUser.mutateAsync({
                      id: String(item.id),
                      password: generated,
                    });
                    showToast("success", `Временный пароль: ${generated}`);
                  } catch (error) {
                    showToast("error", extractErrorMessage(error));
                  }
                }}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
              >
                Сгенерировать пароль
              </button>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <h2 className="mb-3 font-semibold">Редактирование офисов</h2>
        <div className="space-y-3">
          {data.offices.map((office) => (
            <div key={office.id} className="rounded-xl border border-gray-200 p-3">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                <input
                  value={getOfficeDraft(office).name}
                  onChange={(event) =>
                    setOfficeDrafts((prev) => ({
                      ...prev,
                      [office.id]: { ...getOfficeDraft(office), name: event.target.value },
                    }))
                  }
                  placeholder="Название офиса"
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                />
                <input
                  value={getOfficeDraft(office).city}
                  onChange={(event) =>
                    setOfficeDrafts((prev) => ({
                      ...prev,
                      [office.id]: { ...getOfficeDraft(office), city: event.target.value },
                    }))
                  }
                  placeholder="Город"
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                />
                <input
                  value={getOfficeDraft(office).address}
                  onChange={(event) =>
                    setOfficeDrafts((prev) => ({
                      ...prev,
                      [office.id]: { ...getOfficeDraft(office), address: event.target.value },
                    }))
                  }
                  placeholder="Адрес"
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                />
                <input
                  type="number"
                  min={0}
                  value={getOfficeDraft(office).rating}
                  onChange={(event) =>
                    setOfficeDrafts((prev) => ({
                      ...prev,
                      [office.id]: { ...getOfficeDraft(office), rating: event.target.value },
                    }))
                  }
                  placeholder="Рейтинг"
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                />
                <select
                  value={getOfficeDraft(office).headId}
                  onChange={(event) =>
                    setOfficeDrafts((prev) => ({
                      ...prev,
                      [office.id]: { ...getOfficeDraft(office), headId: event.target.value },
                    }))
                  }
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                >
                  <option value="">Без руководителя</option>
                  {data.users.map((employee) => (
                    <option key={String(employee.id)} value={String(employee.id)}>
                      {employee.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-2">
                <button
                  onClick={async () => {
                    try {
                      await updateOffice.mutateAsync({
                        id: office.id,
                        name: getOfficeDraft(office).name.trim(),
                        city: getOfficeDraft(office).city.trim(),
                        address: getOfficeDraft(office).address.trim(),
                        rating: Number(getOfficeDraft(office).rating || 0),
                        headId: getOfficeDraft(office).headId ? getOfficeDraft(office).headId : null,
                      });
                      showToast("success", `Офис ${office.name} сохранен`);
                    } catch (error) {
                      showToast("error", extractErrorMessage(error));
                    }
                  }}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  Сохранить офис
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

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
