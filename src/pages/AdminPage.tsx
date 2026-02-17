import { useState } from "react";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { useAuth } from "../contexts/useAuth";
import { portalRepository } from "../services/portalRepository";
import {
  useAdminAuditQuery,
  useAdminCreateUserMutation,
  useAdminCreateShopProductMutation,
  useAdminShopProductsQuery,
  useAdminUpdateOfficeMutation,
  useAdminUpdateShopProductMutation,
  useUpdateShopOrderStatusMutation,
  useAdminUpdateUserMutation,
  usePortalData,
} from "../hooks/usePortalData";
import { canAccessAdmin } from "../lib/permissions";
import { RoleLabels, type Office, type Role, type ShopProduct, type User } from "../domain/models";
import { useSearchParams } from "react-router-dom";

const roleOptions: Role[] = ["operator", "office_head", "director", "admin"];
type ToastItem = { id: number; kind: "success" | "error"; message: string };
type AdminTab = "users" | "offices" | "orders" | "other";
const shopOrderStatusOptions: Array<{ value: "new" | "processing" | "shipped" | "delivered" | "cancelled"; label: string }> = [
  { value: "new", label: "Новый" },
  { value: "processing", label: "В обработке" },
  { value: "shipped", label: "Отгружен" },
  { value: "delivered", label: "Доставлен" },
  { value: "cancelled", label: "Отменен" },
];

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
  return new Promise<{ image: HTMLImageElement; src: string }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result ?? "");
      const image = new Image();
      image.onload = () => resolve({ image, src });
      image.onerror = () => reject(new Error("Не удалось открыть изображение"));
      image.src = src;
    };
    reader.onerror = () => reject(new Error("Не удалось прочитать изображение"));
    reader.readAsDataURL(file);
  });
}

async function compressShopImage(file: File): Promise<{ base64: string; mimeType: string }> {
  if (file.type === "image/gif") {
    return { base64: await toBase64(file), mimeType: "image/gif" };
  }

  const { image } = await readImageDimensions(file);
  const maxSide = 1200;
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

  return { base64: await toBase64(new File([blob], "shop-image.webp", { type: mimeType })), mimeType };
}

export function AdminPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data } = usePortalData();
  const { user } = useAuth();
  const createUser = useAdminCreateUserMutation();
  const updateUser = useAdminUpdateUserMutation();
  const updateOffice = useAdminUpdateOfficeMutation();
  const updateShopOrderStatus = useUpdateShopOrderStatusMutation();
  const createShopProduct = useAdminCreateShopProductMutation();
  const updateShopProduct = useAdminUpdateShopProductMutation();

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
  const [shopProductDrafts, setShopProductDrafts] = useState<
    Record<number, { name: string; description: string; category: string; pricePoints: string; imageUrl: string; isActive: boolean }>
  >({});
  const [shopProductImageFiles, setShopProductImageFiles] = useState<Record<number, File | null>>({});
  const [newShopProduct, setNewShopProduct] = useState<{
    name: string;
    description: string;
    category: string;
    pricePoints: string;
    imageUrl: string;
  }>({
    name: "",
    description: "",
    category: "",
    pricePoints: "",
    imageUrl: "",
  });
  const [newShopProductImageFile, setNewShopProductImageFile] = useState<File | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const initialTab = (() => {
    const raw = searchParams.get("tab");
    if (raw === "users" || raw === "offices" || raw === "orders" || raw === "other") return raw as AdminTab;
    return "users";
  })();
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);
  const pageSize = Number(auditLimit) || 50;
  const canViewShopOrders = user?.role === "office_head" || user?.role === "director" || user?.role === "admin";
  const adminShopProducts = useAdminShopProductsQuery(Boolean(user && canAccessAdmin(user.role) && canViewShopOrders));
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

  function switchTab(tab: AdminTab) {
    setActiveTab(tab);
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    setSearchParams(next, { replace: true });
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

  function getShopProductDraft(item: ShopProduct) {
    return (
      shopProductDrafts[item.id] ?? {
        name: item.name,
        description: item.description ?? "",
        category: item.category,
        pricePoints: String(item.pricePoints),
        imageUrl: item.imageUrl ?? "",
        isActive: item.isActive,
      }
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Админка</h1>
      <Card className="p-2">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => switchTab("users")}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              activeTab === "users" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Пользователи ({data.users.length})
          </button>
          <button
            onClick={() => switchTab("offices")}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              activeTab === "offices" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Офисы ({data.offices.length})
          </button>
          <button
            onClick={() => switchTab("other")}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              activeTab === "other" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Другое (журнал)
          </button>
          {canViewShopOrders ? (
            <button
              onClick={() => switchTab("orders")}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                activeTab === "orders" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Заказы магазина ({data.shopOrders.length})
            </button>
          ) : null}
        </div>
      </Card>
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

      {activeTab === "users" ? (
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
      ) : null}

      {activeTab === "users" ? (
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
      ) : null}

      {activeTab === "offices" ? (
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
      ) : null}

      {activeTab === "orders" ? (
      <Card className="p-4">
        <h2 className="mb-3 font-semibold">Товары и заказы внутреннего магазина</h2>
        <div className="mb-4 rounded-xl border border-gray-200 p-3">
          <h3 className="mb-2 text-sm font-semibold text-gray-900">Редактор товаров</h3>
          <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-5">
            <input
              value={newShopProduct.name}
              onChange={(event) => setNewShopProduct((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Название"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              value={newShopProduct.category}
              onChange={(event) => setNewShopProduct((prev) => ({ ...prev, category: event.target.value }))}
              placeholder="Категория"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              value={newShopProduct.pricePoints}
              onChange={(event) => setNewShopProduct((prev) => ({ ...prev, pricePoints: event.target.value }))}
              placeholder="Цена в баллах"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              value={newShopProduct.imageUrl}
              onChange={(event) => setNewShopProduct((prev) => ({ ...prev, imageUrl: event.target.value }))}
              placeholder="URL картинки"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <label className="flex items-center rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(event) => setNewShopProductImageFile(event.target.files?.[0] ?? null)}
                className="text-sm"
              />
            </label>
            <button
              onClick={async () => {
                if (!newShopProduct.name.trim() || !newShopProduct.category.trim()) {
                  showToast("error", "Заполните название и категорию товара");
                  return;
                }
                const pricePoints = Number(newShopProduct.pricePoints);
                if (!Number.isFinite(pricePoints) || pricePoints < 1) {
                  showToast("error", "Цена должна быть больше 0");
                  return;
                }
                try {
                  let imageDataBase64: string | undefined;
                  let imageMimeType: string | undefined;
                  if (newShopProductImageFile) {
                    const compressed = await compressShopImage(newShopProductImageFile);
                    imageDataBase64 = compressed.base64;
                    imageMimeType = compressed.mimeType;
                  }
                  await createShopProduct.mutateAsync({
                    name: newShopProduct.name.trim(),
                    description: newShopProduct.description.trim() || undefined,
                    category: newShopProduct.category.trim(),
                    pricePoints,
                    isMaterial: true,
                    isActive: true,
                    imageUrl: newShopProduct.imageUrl.trim() || undefined,
                    imageDataBase64,
                    imageMimeType,
                  });
                  setNewShopProduct({ name: "", description: "", category: "", pricePoints: "", imageUrl: "" });
                  setNewShopProductImageFile(null);
                  showToast("success", "Товар создан");
                } catch (error) {
                  showToast("error", extractErrorMessage(error));
                }
              }}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Добавить товар
            </button>
            <input
              value={newShopProduct.description}
              onChange={(event) => setNewShopProduct((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Описание"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm md:col-span-5"
            />
          </div>
          <div className="space-y-2">
            {(adminShopProducts.data ?? data.shopProducts).map((product) => (
              <div key={product.id} className="rounded-xl border border-gray-200 p-3">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
                  <input
                    value={getShopProductDraft(product).name}
                    onChange={(event) =>
                      setShopProductDrafts((prev) => ({
                        ...prev,
                        [product.id]: { ...getShopProductDraft(product), name: event.target.value },
                      }))
                    }
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                  />
                  <input
                    value={getShopProductDraft(product).category}
                    onChange={(event) =>
                      setShopProductDrafts((prev) => ({
                        ...prev,
                        [product.id]: { ...getShopProductDraft(product), category: event.target.value },
                      }))
                    }
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                  />
                  <input
                    value={getShopProductDraft(product).pricePoints}
                    onChange={(event) =>
                      setShopProductDrafts((prev) => ({
                        ...prev,
                        [product.id]: { ...getShopProductDraft(product), pricePoints: event.target.value },
                      }))
                    }
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                  />
                  <input
                    value={getShopProductDraft(product).imageUrl}
                    onChange={(event) =>
                      setShopProductDrafts((prev) => ({
                        ...prev,
                        [product.id]: { ...getShopProductDraft(product), imageUrl: event.target.value },
                      }))
                    }
                    placeholder="URL картинки"
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                  />
                  <label className="flex items-center rounded-lg border border-gray-300 px-3 py-1.5 text-sm">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      onChange={(event) =>
                        setShopProductImageFiles((prev) => ({
                          ...prev,
                          [product.id]: event.target.files?.[0] ?? null,
                        }))
                      }
                      className="text-sm"
                    />
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={getShopProductDraft(product).isActive}
                      onChange={(event) =>
                        setShopProductDrafts((prev) => ({
                          ...prev,
                          [product.id]: { ...getShopProductDraft(product), isActive: event.target.checked },
                        }))
                      }
                    />
                    Активен
                  </label>
                  <input
                    value={getShopProductDraft(product).description}
                    onChange={(event) =>
                      setShopProductDrafts((prev) => ({
                        ...prev,
                        [product.id]: { ...getShopProductDraft(product), description: event.target.value },
                      }))
                    }
                    placeholder="Описание"
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm md:col-span-4"
                  />
                  {(product.imageDataBase64 || getShopProductDraft(product).imageUrl) ? (
                    <div className="md:col-span-4">
                      <div
                        className="flex w-24 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-white p-1"
                        style={{ aspectRatio: "1 / 1" }}
                      >
                        <img
                          src={
                            product.imageDataBase64
                              ? `data:${product.imageMimeType ?? "image/png"};base64,${product.imageDataBase64}`
                              : (getShopProductDraft(product).imageUrl || "")
                          }
                          alt={product.name}
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="md:col-span-4 text-xs text-gray-400">Картинка не задана</div>
                  )}
                  <button
                    onClick={async () => {
                      const draft = getShopProductDraft(product);
                      const pricePoints = Number(draft.pricePoints);
                      if (!draft.name.trim() || !draft.category.trim()) {
                        showToast("error", "Название и категория обязательны");
                        return;
                      }
                      if (!Number.isFinite(pricePoints) || pricePoints < 1) {
                        showToast("error", "Цена должна быть больше 0");
                        return;
                      }
                      try {
                        const nextFile = shopProductImageFiles[product.id];
                        let imageDataBase64: string | null | undefined;
                        let imageMimeType: string | null | undefined;
                        if (nextFile) {
                          const compressed = await compressShopImage(nextFile);
                          imageDataBase64 = compressed.base64;
                          imageMimeType = compressed.mimeType;
                        }
                        await updateShopProduct.mutateAsync({
                          id: product.id,
                          name: draft.name.trim(),
                          description: draft.description.trim() || null,
                          category: draft.category.trim(),
                          pricePoints,
                          imageUrl: draft.imageUrl.trim() || null,
                          imageDataBase64,
                          imageMimeType,
                          isActive: draft.isActive,
                        });
                        setShopProductImageFiles((prev) => ({ ...prev, [product.id]: null }));
                        showToast("success", `Товар "${draft.name}" сохранен`);
                      } catch (error) {
                        showToast("error", extractErrorMessage(error));
                      }
                    }}
                    className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-black"
                  >
                    Сохранить
                  </button>
                </div>
              </div>
            ))}
            {adminShopProducts.isLoading ? <p className="text-xs text-gray-500">Загрузка товаров...</p> : null}
          </div>
        </div>
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Отслеживание заказов</h3>
        <div className="space-y-3">
          {data.shopOrders.map((order) => {
            const buyer = data.users.find((item) => String(item.id) === String(order.buyerUserId));
            const office = order.officeId ? data.offices.find((item) => item.id === order.officeId) : null;
            const items = data.shopOrderItems.filter((item) => item.orderId === order.id);
            return (
              <div key={order.id} className="rounded-xl border border-gray-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      Заказ #{order.id} · {buyer?.name ?? order.buyerUserId}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(order.createdAt).toLocaleString()} · {office ? office.name : "Офис не указан"} · {order.totalPoints} баллов
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={order.status}
                      onChange={async (event) => {
                        try {
                          await updateShopOrderStatus.mutateAsync({
                            id: order.id,
                            status: event.target.value as "new" | "processing" | "shipped" | "delivered" | "cancelled",
                          });
                          showToast("success", `Статус заказа #${order.id} обновлен`);
                        } catch (error) {
                          showToast("error", extractErrorMessage(error));
                        }
                      }}
                      className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
                    >
                      {shopOrderStatusOptions.map((statusOption) => (
                        <option key={statusOption.value} value={statusOption.value}>
                          {statusOption.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {order.deliveryInfo ? (
                  <p className="mt-2 text-xs text-gray-600">Доставка: {order.deliveryInfo}</p>
                ) : null}
                {order.comment ? (
                  <p className="mt-1 text-xs text-gray-600">Комментарий: {order.comment}</p>
                ) : null}
                <div className="mt-2 rounded-lg bg-gray-50 p-2">
                  {items.map((item) => (
                    <p key={item.id} className="text-xs text-gray-700">
                      {item.productName} × {item.quantity} = {item.subtotalPoints} баллов
                    </p>
                  ))}
                  {items.length === 0 ? (
                    <p className="text-xs text-gray-500">Позиции заказа не найдены</p>
                  ) : null}
                </div>
              </div>
            );
          })}
          {data.shopOrders.length === 0 ? (
            <p className="text-sm text-gray-500">Заказов пока нет.</p>
          ) : null}
        </div>
      </Card>
      ) : null}

      {activeTab === "other" ? (
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
      ) : null}
    </div>
  );
}
