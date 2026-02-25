import { Building2, ClipboardList, Coins, Package, ScrollText, Users, X, Plus } from "lucide-react";
import { useState } from "react";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { useAuth } from "../contexts/useAuth";
import { portalRepository } from "../services/portalRepository";
import {
  useAdminAuditQuery,
  useAdminCreateOfficeMutation,
  useAdminCreateUserMutation,
  useAdminCreateShopProductMutation,
  useAdminShopProductsQuery,
  useAdminUpdateOfficeMutation,
  useAdminUpdateShopProductMutation,
  useUpdateShopOrderStatusMutation,
  useAdminUpdateUserMutation,
  useAwardPointsMutation,
  useCreatePointsCampaignMutation,
  useCreatePointsRuleMutation,
  usePointsActionsQuery,
  usePointsCampaignsQuery,
  usePointsEventsQuery,
  usePointsRulesQuery,
  usePortalData,
  useUpdatePointsCampaignMutation,
  useUpdatePointsRuleMutation,
} from "../hooks/usePortalData";
import { canAccessAdmin } from "../lib/permissions";
import { RoleLabels, type Office, type Role, type ShopProduct, type User } from "../domain/models";
import { useSearchParams } from "react-router-dom";

const roleOptions: Role[] = ["operator", "office_head", "director", "admin"];
type ToastItem = { id: number; kind: "success" | "error"; message: string };
type AdminTab = "users" | "offices" | "points" | "orders" | "products" | "other";
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
  const createOffice = useAdminCreateOfficeMutation();
  const updateUser = useAdminUpdateUserMutation();
  const updateOffice = useAdminUpdateOfficeMutation();
  const updateShopOrderStatus = useUpdateShopOrderStatusMutation();
  const createShopProduct = useAdminCreateShopProductMutation();
  const updateShopProduct = useAdminUpdateShopProductMutation();
  const pointsActions = usePointsActionsQuery(Boolean(user && canAccessAdmin(user.role)));
  const pointsRules = usePointsRulesQuery(Boolean(user && canAccessAdmin(user.role)));
  const pointsCampaigns = usePointsCampaignsQuery(Boolean(user && canAccessAdmin(user.role)));
  const pointsEvents = usePointsEventsQuery({ limit: 50, enabled: Boolean(user && canAccessAdmin(user.role)) });
  const createPointsRule = useCreatePointsRuleMutation();
  const updatePointsRule = useUpdatePointsRuleMutation();
  const createPointsCampaign = useCreatePointsCampaignMutation();
  const updatePointsCampaign = useUpdatePointsCampaignMutation();
  const awardPoints = useAwardPointsMutation();

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
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState<Role | "all">("all");
  const [officeDrafts, setOfficeDrafts] = useState<
    Record<number, { name: string; city: string; address: string; rating: string; headId: string }>
  >({});
  const [officeSearch, setOfficeSearch] = useState("");
  const [newOffice, setNewOffice] = useState<{ name: string; city: string; address: string; rating: string; headId: string }>({
    name: "",
    city: "",
    address: "",
    rating: "0",
    headId: "",
  });
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
  const [pointsRuleDraft, setPointsRuleDraft] = useState({
    actionKey: "",
    title: "",
    description: "",
    basePoints: "5",
  });
  const [pointsCampaignDraft, setPointsCampaignDraft] = useState({
    name: "",
    description: "",
    actionKey: "",
    bonusPoints: "0",
    multiplier: "1",
    startsAt: "",
    endsAt: "",
  });
  const [pointsAwardDraft, setPointsAwardDraft] = useState({
    userId: "",
    actionKey: "manual_bonus",
    basePoints: "0",
    comment: "",
  });
  const initialTab = (() => {
    const raw = searchParams.get("tab");
    if (raw === "users" || raw === "offices" || raw === "points" || raw === "orders" || raw === "products" || raw === "other") return raw as AdminTab;
    return "users";
  })();
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const pageSize = Number(auditLimit) || 50;
  const canViewShopOrders = user?.role === "office_head" || user?.role === "director" || user?.role === "admin";
  const canCreateUsers = user?.role === "admin" || user?.role === "director" || user?.role === "office_head";
  const createUserRoleOptions: Role[] = user?.role === "office_head" ? ["operator"] : roleOptions;
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

  function userHasUnsavedChanges(item: User) {
    const draft = getUserDraft(item);
    return (
      draft.fullName !== item.name
      || draft.email !== (item.email ?? "")
      || draft.phone !== (item.phone ?? "")
      || draft.position !== (item.position ?? "")
      || draft.role !== item.role
      || draft.officeId !== (item.officeId ? String(item.officeId) : "")
    );
  }

  function officeHasUnsavedChanges(item: Office) {
    const draft = getOfficeDraft(item);
    return (
      draft.name !== item.name
      || draft.city !== item.city
      || draft.address !== item.address
      || draft.rating !== String(item.rating ?? 0)
      || draft.headId !== (item.headId ? String(item.headId) : "")
    );
  }

  const officeHeadCandidates = data.users.filter((employee) => employee.role === "office_head");
  const filteredUsers = data.users.filter((item) => {
    if (userRoleFilter !== "all" && item.role !== userRoleFilter) {
      return false;
    }
    const query = userSearch.trim().toLowerCase();
    if (!query) return true;
    return (
      item.name.toLowerCase().includes(query)
      || (item.email ?? "").toLowerCase().includes(query)
      || (item.position ?? "").toLowerCase().includes(query)
    );
  });
  const filteredOffices = data.offices.filter((office) => {
    const q = officeSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      office.name.toLowerCase().includes(q)
      || office.city.toLowerCase().includes(q)
      || office.address.toLowerCase().includes(q)
    );
  });

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
      <Card className="border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Админка</h1>
          <p className="mt-1 text-sm text-zinc-500">Управление сотрудниками, офисами и служебными настройками</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => switchTab("users")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${activeTab === "users" ? "bg-zinc-900 text-white shadow-sm hover:bg-zinc-800" : "bg-white text-zinc-700 hover:bg-zinc-100 border border-zinc-200"
              }`}
          >
            <Users className="h-4 w-4" />
            Пользователи ({data.users.length})
          </button>
          <button
            onClick={() => switchTab("offices")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${activeTab === "offices" ? "bg-zinc-900 text-white shadow-sm hover:bg-zinc-800" : "bg-white text-zinc-700 hover:bg-zinc-100 border border-zinc-200"
              }`}
          >
            <Building2 className="h-4 w-4" />
            Офисы ({data.offices.length})
          </button>
          <button
            onClick={() => switchTab("points")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${activeTab === "points" ? "bg-zinc-900 text-white shadow-sm hover:bg-zinc-800" : "bg-white text-zinc-700 hover:bg-zinc-100 border border-zinc-200"
              }`}
          >
            <Coins className="h-4 w-4" />
            Баллы
          </button>
          <button
            onClick={() => switchTab("other")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${activeTab === "other" ? "bg-zinc-900 text-white shadow-sm hover:bg-zinc-800" : "bg-white text-zinc-700 hover:bg-zinc-100 border border-zinc-200"
              }`}
          >
            <ScrollText className="h-4 w-4" />
            Другое (журнал)
          </button>
          {canViewShopOrders ? (
            <>
              <button
                onClick={() => switchTab("products")}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${activeTab === "products" ? "bg-zinc-900 text-white shadow-sm hover:bg-zinc-800" : "bg-white text-zinc-700 hover:bg-zinc-100 border border-zinc-200"
                  }`}
              >
                <Package className="h-4 w-4" />
                Товары магазина
              </button>
              <button
                onClick={() => switchTab("orders")}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${activeTab === "orders" ? "bg-zinc-900 text-white shadow-sm hover:bg-zinc-800" : "bg-white text-zinc-700 hover:bg-zinc-100 border border-zinc-200"
                  }`}
              >
                <ClipboardList className="h-4 w-4" />
                Заказы ({data.shopOrders.length})
              </button>
            </>
          ) : null}
        </div>
      </Card>
      <div className="fixed right-4 top-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`max-w-sm rounded-lg px-3 py-2 text-sm font-semibold text-white shadow-lg ${toast.kind === "success" ? "bg-emerald-600" : "bg-red-600"
              }`}
          >
            {toast.message}
          </div>
        ))}
      </div>

      {activeTab === "users" && canCreateUsers ? (
        <Card className="border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-tight text-zinc-900">Добавить пользователя</h2>
            <Badge className="bg-zinc-100 text-zinc-700 font-semibold border-transparent shadow-none">Шаг 1: регистрация</Badge>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="ФИО"
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
            />
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
            />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Пароль (мин. 8)"
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
            />
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as Role)}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
            >
              {createUserRoleOptions.map((item) => (
                <option key={item} value={item}>
                  {RoleLabels[item]}
                </option>
              ))}
            </select>
            <select
              value={user.role === "office_head" ? String(user.officeId) : officeId}
              onChange={(event) => setOfficeId(event.target.value)}
              disabled={user.role === "office_head"}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 disabled:bg-zinc-50 disabled:text-zinc-500"
            >
              {user.role === "office_head" ? null : <option value="">Без офиса</option>}
              {data.offices
                .filter((office) => (user.role === "office_head" ? office.id === user.officeId : true))
                .map((office) => (
                  <option key={office.id} value={office.id}>
                    {office.name}
                  </option>
                ))}
            </select>
            <button
              onClick={async () => {
                if (!email.trim() || !password.trim() || !fullName.trim()) {
                  showToast("error", "Заполните ФИО, email и пароль");
                  return;
                }
                if (password.trim().length < 8) {
                  showToast("error", "Пароль должен быть не короче 8 символов");
                  return;
                }
                try {
                  await createUser.mutateAsync({
                    email: email.trim(),
                    password: password.trim(),
                    fullName: fullName.trim(),
                    role,
                    officeId: user.role === "office_head" ? user.officeId : (officeId ? Number(officeId) : null),
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
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-60"
              disabled={createUser.isPending}
            >
              {createUser.isPending ? "Создание..." : "Создать пользователя"}
            </button>
          </div>
        </Card>
      ) : null}

      {activeTab === "users" ? (
        <div className="space-y-4">
          <Card className="border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <input
                value={userSearch}
                onChange={(event) => setUserSearch(event.target.value)}
                placeholder="Поиск: ФИО, email, должность"
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 md:col-span-2"
              />
              <select
                value={userRoleFilter}
                onChange={(event) => setUserRoleFilter(event.target.value as Role | "all")}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
              >
                <option value="all">Все роли</option>
                {roleOptions.map((option) => (
                  <option key={option} value={option}>
                    {RoleLabels[option]}
                  </option>
                ))}
              </select>
            </div>
          </Card>
          {filteredUsers.map((item) => (
            <Card key={String(item.id)} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:shadow-md">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="font-bold text-zinc-900">{item.name}</span>
                <Badge className="bg-zinc-100 text-zinc-600 font-medium border-transparent shadow-none">{item.email || "без email"}</Badge>
                <Badge className="bg-zinc-800 text-white font-medium border-transparent shadow-none">{RoleLabels[item.role]}</Badge>
                {userHasUnsavedChanges(item) ? (
                  <Badge className="bg-amber-100 text-amber-800 font-semibold border-transparent shadow-none">Есть изменения</Badge>
                ) : null}
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <input
                  value={getUserDraft(item).fullName}
                  onChange={(event) =>
                    setUserDrafts((prev) => ({
                      ...prev,
                      [String(item.id)]: { ...getUserDraft(item), fullName: event.target.value },
                    }))
                  }
                  placeholder="ФИО"
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
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
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
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
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
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
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
                />
                <select
                  value={getUserDraft(item).role}
                  onChange={(event) =>
                    setUserDrafts((prev) => ({
                      ...prev,
                      [String(item.id)]: { ...getUserDraft(item), role: event.target.value as Role },
                    }))
                  }
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
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
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
                >
                  <option value="">Без офиса</option>
                  {data.offices.map((office) => (
                    <option key={office.id} value={office.id}>
                      {office.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
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
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-60"
                  disabled={updateUser.isPending}
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
                  className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
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
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
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
                  className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
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
                  className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
                >
                  Сгенерировать пароль
                </button>
              </div>
            </Card>
          ))}
          {filteredUsers.length === 0 ? (
            <Card className="p-6 text-center text-sm font-medium text-zinc-500 border-dashed border-zinc-300 bg-zinc-50 shadow-none">По текущим фильтрам сотрудники не найдены.</Card>
          ) : null}
        </div>
      ) : null}

      {activeTab === "offices" ? (
        <div className="space-y-4">
          <Card className="border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold tracking-tight text-zinc-900">Создать офис</h2>
              <span className="rounded-lg bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 shadow-none border-transparent">
                {data.offices.length} офисов
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
              <input
                value={newOffice.name}
                onChange={(event) => setNewOffice((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Название офиса"
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 md:col-span-2"
              />
              <input
                value={newOffice.city}
                onChange={(event) => setNewOffice((prev) => ({ ...prev, city: event.target.value }))}
                placeholder="Город"
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
              />
              <input
                value={newOffice.address}
                onChange={(event) => setNewOffice((prev) => ({ ...prev, address: event.target.value }))}
                placeholder="Адрес"
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 md:col-span-2"
              />
              <input
                type="number"
                min={0}
                value={newOffice.rating}
                onChange={(event) => setNewOffice((prev) => ({ ...prev, rating: event.target.value }))}
                placeholder="Рейтинг"
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
              />
              <select
                value={newOffice.headId}
                onChange={(event) => setNewOffice((prev) => ({ ...prev, headId: event.target.value }))}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 md:col-span-3"
              >
                <option value="">Без руководителя</option>
                {officeHeadCandidates.map((employee) => (
                  <option key={String(employee.id)} value={String(employee.id)}>
                    {employee.name}
                  </option>
                ))}
              </select>
              <input
                value={officeSearch}
                onChange={(event) => setOfficeSearch(event.target.value)}
                placeholder="Поиск: название, город, адрес"
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 md:col-span-2"
              />
              <div className="md:col-span-1">
                <button
                  onClick={async () => {
                    if (newOffice.name.trim().length < 2 || newOffice.city.trim().length < 2 || newOffice.address.trim().length < 3) {
                      showToast("error", "Заполните название, город и адрес офиса");
                      return;
                    }
                    const rating = Number(newOffice.rating || 0);
                    if (!Number.isFinite(rating) || rating < 0) {
                      showToast("error", "Рейтинг должен быть числом 0 или больше");
                      return;
                    }
                    try {
                      await createOffice.mutateAsync({
                        name: newOffice.name.trim(),
                        city: newOffice.city.trim(),
                        address: newOffice.address.trim(),
                        rating,
                        headId: newOffice.headId || null,
                      });
                      showToast("success", `Офис «${newOffice.name.trim()}» создан`);
                      setNewOffice({ name: "", city: "", address: "", rating: "0", headId: "" });
                    } catch (error) {
                      showToast("error", extractErrorMessage(error));
                    }
                  }}
                  className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60"
                  disabled={createOffice.isPending}
                >
                  {createOffice.isPending ? "Создание..." : "Создать офис"}
                </button>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {filteredOffices.map((office) => {
              const draft = getOfficeDraft(office);
              return (
                <Card key={office.id} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:shadow-md">
                  <div className="mb-4 flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-0.5">Офис #{office.id}</p>
                      <h3 className="text-lg font-bold text-zinc-900 tracking-tight">{office.name}</h3>
                    </div>
                    {officeHasUnsavedChanges(office) ? (
                      <Badge className="bg-amber-100 text-amber-800 font-semibold border-transparent shadow-none">Есть изменения</Badge>
                    ) : (
                      <Badge className="bg-zinc-100 text-zinc-600 font-semibold border-transparent shadow-none">Синхронизировано</Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    <input
                      value={draft.name}
                      onChange={(event) =>
                        setOfficeDrafts((prev) => ({
                          ...prev,
                          [office.id]: { ...draft, name: event.target.value },
                        }))
                      }
                      placeholder="Название офиса"
                      className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
                    />
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <input
                        value={draft.city}
                        onChange={(event) =>
                          setOfficeDrafts((prev) => ({
                            ...prev,
                            [office.id]: { ...draft, city: event.target.value },
                          }))
                        }
                        placeholder="Город"
                        className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
                      />
                      <input
                        type="number"
                        min={0}
                        value={draft.rating}
                        onChange={(event) =>
                          setOfficeDrafts((prev) => ({
                            ...prev,
                            [office.id]: { ...draft, rating: event.target.value },
                          }))
                        }
                        placeholder="Рейтинг"
                        className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
                      />
                    </div>
                    <input
                      value={draft.address}
                      onChange={(event) =>
                        setOfficeDrafts((prev) => ({
                          ...prev,
                          [office.id]: { ...draft, address: event.target.value },
                        }))
                      }
                      placeholder="Адрес"
                      className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
                    />
                    <select
                      value={draft.headId}
                      onChange={(event) =>
                        setOfficeDrafts((prev) => ({
                          ...prev,
                          [office.id]: { ...draft, headId: event.target.value },
                        }))
                      }
                      className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
                    >
                      <option value="">Без руководителя</option>
                      {officeHeadCandidates.map((employee) => (
                        <option key={String(employee.id)} value={String(employee.id)}>
                          {employee.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={async () => {
                        try {
                          await updateOffice.mutateAsync({
                            id: office.id,
                            name: draft.name.trim(),
                            city: draft.city.trim(),
                            address: draft.address.trim(),
                            rating: Number(draft.rating || 0),
                            headId: draft.headId ? draft.headId : null,
                          });
                          showToast("success", `Офис ${office.name} сохранен`);
                        } catch (error) {
                          showToast("error", extractErrorMessage(error));
                        }
                      }}
                      className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-60"
                      disabled={updateOffice.isPending}
                    >
                      Сохранить офис
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ) : null}

      {activeTab === "products" ? (
        <Card className="border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-zinc-900">Товары магазина</h2>
              <p className="mt-1 text-sm text-zinc-500">Добавление и редактирование доступных товаров</p>
            </div>
            <button
              onClick={() => setIsAddingProduct(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800"
            >
              <Plus className="h-4 w-4" />
              Добавить товар
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {(adminShopProducts.data ?? data.shopProducts).map((product) => (
              <button
                type="button"
                key={product.id}
                onClick={() => setEditingProductId(product.id)}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white text-left shadow-sm transition-all hover:-translate-y-1 hover:border-zinc-300 hover:shadow-md"
              >
                <div className="aspect-[4/3] w-full overflow-hidden bg-zinc-50 border-b border-zinc-100 flex items-center justify-center p-4">
                  <img
                    src={product.imageDataBase64 ? `data:${product.imageMimeType ?? "image/png"};base64,${product.imageDataBase64}` : (product.imageUrl || "")}
                    alt={product.name}
                    className="max-h-full max-w-full object-contain mix-blend-multiply transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="flex flex-col p-4 flex-1">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h4 className="font-bold text-zinc-900 leading-tight line-clamp-2">{product.name}</h4>
                    <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${product.isActive ? 'bg-zinc-100 text-zinc-700' : 'bg-red-50 text-red-600'}`}>
                      {product.isActive ? 'Активен' : 'Скрыт'}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-zinc-500 mb-2">{product.category}</p>

                  <div className="mt-auto flex items-center justify-between pt-3">
                    <div className="flex items-center gap-1.5 font-bold text-zinc-900 bg-zinc-50 rounded-lg px-2.5 py-1 text-sm border border-zinc-200 shadow-sm">
                      <Coins className="h-4 w-4 text-zinc-700" />
                      {product.pricePoints}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {(isAddingProduct || editingProductId !== null) ? (() => {
            const isEditing = editingProductId !== null;
            const product = isEditing ? (adminShopProducts.data ?? data.shopProducts).find((p) => p.id === editingProductId) : null;
            const draft = isEditing && product ? getShopProductDraft(product) : newShopProduct;

            const handleClose = () => {
              setIsAddingProduct(false);
              setEditingProductId(null);
            };

            const handleFieldChange = (field: string, value: string | boolean) => {
              if (isEditing && product) {
                setShopProductDrafts((prev) => ({
                  ...prev,
                  [product.id]: { ...getShopProductDraft(product), [field]: value }
                }));
              } else {
                setNewShopProduct((prev) => ({ ...prev, [field]: value }));
              }
            };

            const currentFile = isEditing && product ? shopProductImageFiles[product.id] : newShopProductImageFile;

            const handleSave = async () => {
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
                let imageDataBase64: string | undefined;
                let imageMimeType: string | undefined;

                if (currentFile) {
                  const compressed = await compressShopImage(currentFile);
                  imageDataBase64 = compressed.base64;
                  imageMimeType = compressed.mimeType;
                }

                if (isEditing && product) {
                  const pDraft = draft as typeof shopProductDrafts[number];
                  await updateShopProduct.mutateAsync({
                    ...product,
                    name: pDraft.name.trim(),
                    description: pDraft.description?.trim() || null,
                    category: pDraft.category.trim(),
                    pricePoints,
                    imageUrl: pDraft.imageUrl?.trim() || null,
                    imageDataBase64,
                    imageMimeType,
                    isActive: pDraft.isActive,
                  });
                  setShopProductImageFiles((prev) => ({ ...prev, [product.id]: null }));
                  showToast("success", `Товар "${pDraft.name}" сохранен`);
                } else {
                  const nDraft = draft as typeof newShopProduct;
                  await createShopProduct.mutateAsync({
                    name: nDraft.name.trim(),
                    description: nDraft.description?.trim() || undefined,
                    category: nDraft.category.trim(),
                    pricePoints,
                    isMaterial: true,
                    isActive: true,
                    imageUrl: nDraft.imageUrl?.trim() || undefined,
                    imageDataBase64,
                    imageMimeType,
                  });
                  setNewShopProduct({ name: "", description: "", category: "", pricePoints: "", imageUrl: "" });
                  setNewShopProductImageFile(null);
                  showToast("success", "Товар создан");
                }

                handleClose();
              } catch (error) {
                showToast("error", extractErrorMessage(error));
              }
            };

            return (
              <div className="fixed inset-0 z-50">
                <button type="button" className="absolute inset-0 bg-zinc-900/30 backdrop-blur-[2px]" onClick={handleClose} />
                <aside className="absolute right-0 top-0 flex h-full w-full max-w-[480px] flex-col border-l border-zinc-200 bg-white shadow-2xl">
                  <div className="sticky top-0 z-10 border-b border-zinc-100 bg-white/95 px-6 py-5 backdrop-blur flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold tracking-tight text-zinc-900">
                        {isEditing ? "Редактировать товар" : "Новый товар"}
                      </h3>
                      {isEditing && product && <p className="text-sm text-zinc-500 mt-1">{product.name}</p>}
                    </div>
                    <button type="button" onClick={handleClose} className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600">
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-auto px-6 py-6 space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-zinc-900">Название</label>
                      <input
                        value={draft.name}
                        onChange={(e) => handleFieldChange("name", e.target.value)}
                        placeholder="Фирменная футболка"
                        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-zinc-900">Категория</label>
                        <input
                          value={draft.category}
                          onChange={(e) => handleFieldChange("category", e.target.value)}
                          placeholder="Мерч"
                          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-zinc-900">Цена (баллов)</label>
                        <input
                          value={draft.pricePoints}
                          onChange={(e) => handleFieldChange("pricePoints", e.target.value)}
                          placeholder="50"
                          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
                        />
                      </div>
                    </div>
                    {isEditing && (
                      <label className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2.5 text-sm font-medium text-zinc-800 cursor-pointer hover:bg-zinc-50 transition w-max">
                        <input
                          type="checkbox"
                          checked={(draft as typeof shopProductDrafts[number]).isActive}
                          onChange={(e) => handleFieldChange("isActive", e.target.checked)}
                          className="accent-zinc-900 w-4 h-4 cursor-pointer"
                        />
                        Товар активен
                      </label>
                    )}
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-zinc-900">Описание</label>
                      <textarea
                        value={"description" in draft ? (draft.description || "") : ""}
                        onChange={(e) => handleFieldChange("description", e.target.value)}
                        placeholder="Подробное описание товара..."
                        rows={3}
                        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 resize-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-zinc-900">Изображение (URL или файл)</label>
                      <input
                        value={draft.imageUrl}
                        onChange={(e) => handleFieldChange("imageUrl", e.target.value)}
                        placeholder="https://example.com/image.png"
                        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 mb-2"
                      />
                      <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50 px-6 py-8 text-sm font-medium text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 cursor-pointer transition text-center">
                        <span className="truncate w-full max-w-[250px] font-semibold text-zinc-800 break-words mb-1">
                          {currentFile ? currentFile.name : (isEditing && product?.imageDataBase64 ? "Загружено (заменить)" : "Выберите файл на компьютере")}
                        </span>
                        <span className="text-xs text-zinc-400">PNG, JPG, WEBP до 5 MB</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          onChange={(e) => {
                            if (isEditing && product) {
                              setShopProductImageFiles((prev) => ({ ...prev, [product.id]: e.target.files?.[0] ?? null }));
                            } else {
                              setNewShopProductImageFile(e.target.files?.[0] ?? null);
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="border-t border-zinc-100 p-6 bg-zinc-50">
                    <button
                      onClick={handleSave}
                      disabled={updateShopProduct.isPending || createShopProduct.isPending}
                      className="w-full rounded-lg bg-zinc-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-60"
                    >
                      {(updateShopProduct.isPending || createShopProduct.isPending) ? "Сохраняем..." : "Сохранить товар"}
                    </button>
                  </div>
                </aside>
              </div>
            );
          })() : null}
        </Card>
      ) : null}

      {activeTab === "orders" ? (
        <Card className="border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-6">
            <h2 className="text-xl font-bold tracking-tight text-zinc-900">Заказы магазина</h2>
            <p className="mt-1 text-sm text-zinc-500">Обработка заказов сотрудников</p>
          </div>
          <div className="space-y-4">
            {[...data.shopOrders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((order) => {
              const buyer = data.users.find((item) => String(item.id) === String(order.buyerUserId));
              const office = order.officeId ? data.offices.find((item) => item.id === order.officeId) : null;
              const items = data.shopOrderItems.filter((item) => item.orderId === order.id);
              return (
                <div key={order.id} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm hover:shadow-md transition">
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-sm font-bold text-zinc-900">Заказ #{order.id}</span>
                        <Badge className="bg-zinc-100 text-zinc-700 hover:bg-zinc-200 font-semibold border-transparent shadow-none">{buyer?.name ?? order.buyerUserId}</Badge>
                        <Badge className="bg-zinc-900 text-white flex items-center shadow-sm font-semibold hover:bg-zinc-800 border-transparent"><Coins className="h-3 w-3 mr-1" /> {order.totalPoints}</Badge>
                      </div>
                      <p className="text-xs font-medium text-zinc-500">
                        {new Date(order.createdAt).toLocaleString()} <span className="mx-1">•</span> {office ? office.name : "Офис не указан"}
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
                        className={`rounded-lg border px-3 py-1.5 text-sm font-semibold outline-none shadow-sm cursor-pointer transition ${order.status === 'new' ? 'border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-300' :
                          order.status === 'processing' ? 'border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300' :
                            order.status === 'delivered' ? 'border-zinc-800 bg-zinc-900 text-white hover:bg-zinc-800 hover:border-zinc-900' :
                              order.status === 'cancelled' ? 'border-red-200 bg-red-50 text-red-700 hover:border-red-300' :
                                'border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-300'
                          }`}
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
                    <p className="mb-3 text-sm text-zinc-700 bg-zinc-50 p-3 rounded-lg border border-zinc-100"><span className="font-semibold text-zinc-900 block mb-1">Доставка:</span> {order.deliveryInfo}</p>
                  ) : null}
                  {order.comment ? (
                    <p className="mb-3 text-sm text-amber-800 bg-amber-50 p-3 rounded-lg border border-amber-100 shadow-sm"><span className="font-semibold text-amber-900 block mb-1">Комментарий:</span> {order.comment}</p>
                  ) : null}
                  <div className="mt-4 divide-y divide-zinc-100 rounded-lg border border-zinc-100 px-4 bg-zinc-50/50">
                    {items.map((item) => (
                      <div key={item.id} className="flex justify-between py-3 items-center">
                        <p className="text-sm text-zinc-900 font-medium">
                          {item.productName}
                        </p>
                        <p className="text-sm text-zinc-600 bg-white px-2.5 py-1 rounded-md border border-zinc-200 shadow-sm font-medium">
                          {item.quantity} шт. <span className="mx-1 text-zinc-300">|</span> <span className="font-bold text-zinc-900">{item.subtotalPoints} б.</span>
                        </p>
                      </div>
                    ))}
                    {items.length === 0 ? (
                      <p className="text-xs text-zinc-500 py-3 text-center">Позиции заказа не найдены</p>
                    ) : null}
                  </div>
                </div>
              );
            })}
            {data.shopOrders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center bg-zinc-50">
                <p className="text-sm text-zinc-500 font-medium">Заказов пока нет.</p>
              </div>
            ) : null}
          </div>
        </Card>
      ) : null}

      {activeTab === "points" ? (
        <div className="space-y-4">
          <Card className="border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold tracking-tight text-zinc-900">Настройка баллов и условий начисления</h2>
              <button
                onClick={() => {
                  pointsActions.refetch();
                  pointsRules.refetch();
                  pointsCampaigns.refetch();
                  pointsEvents.refetch();
                }}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
              >
                Обновить
              </button>
            </div>
            <p className="text-sm text-zinc-500">Руководитель может менять правила, запускать акции и вручную корректировать баллы сотрудников.</p>
          </Card>

          <Card className="border border-zinc-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-base font-bold text-zinc-900 tracking-tight">Новое правило начисления</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <input
                value={pointsRuleDraft.actionKey}
                onChange={(event) => setPointsRuleDraft((prev) => ({ ...prev, actionKey: event.target.value }))}
                placeholder="action_key (например task_completed)"
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
              />
              <input
                value={pointsRuleDraft.title}
                onChange={(event) => setPointsRuleDraft((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Название"
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
              />
              <input
                value={pointsRuleDraft.basePoints}
                onChange={(event) => setPointsRuleDraft((prev) => ({ ...prev, basePoints: event.target.value }))}
                placeholder="Баллы"
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
              />
              <button
                onClick={async () => {
                  try {
                    await createPointsRule.mutateAsync({
                      actionKey: pointsRuleDraft.actionKey.trim(),
                      title: pointsRuleDraft.title.trim(),
                      description: pointsRuleDraft.description.trim() || undefined,
                      basePoints: Number(pointsRuleDraft.basePoints),
                      isActive: true,
                      isAuto: false,
                    });
                    setPointsRuleDraft({ actionKey: "", title: "", description: "", basePoints: "5" });
                    showToast("success", "Правило добавлено");
                  } catch (error) {
                    showToast("error", extractErrorMessage(error));
                  }
                }}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800"
              >
                Добавить правило
              </button>
            </div>
            <textarea
              value={pointsRuleDraft.description}
              onChange={(event) => setPointsRuleDraft((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Описание правила"
              className="mt-4 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 resize-none"
            />
          </Card>

          <Card className="border border-zinc-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-base font-bold text-zinc-900 tracking-tight">Правила начисления</h3>
            <div className="space-y-3">
              {(pointsRules.data ?? []).map((rule) => (
                <div key={rule.id} className="grid grid-cols-1 gap-3 rounded-xl border border-zinc-100 bg-zinc-50/50 p-4 md:grid-cols-[1.3fr_1fr_auto_auto] hover:border-zinc-200 transition">
                  <div>
                    <p className="text-sm font-bold text-zinc-900">{rule.title}</p>
                    <p className="text-xs font-semibold text-zinc-500 mt-0.5">{rule.actionKey} {rule.isAuto ? "• авто" : "• вручную"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      defaultValue={String(rule.basePoints)}
                      onBlur={(event) => {
                        void updatePointsRule.mutateAsync({
                          id: rule.id,
                          patch: { basePoints: Number(event.target.value) },
                        });
                      }}
                      className="w-28 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
                    />
                    <span className="text-xs font-semibold text-zinc-500">баллов</span>
                  </div>
                  <button
                    onClick={() => {
                      void updatePointsRule.mutateAsync({ id: rule.id, patch: { isActive: !rule.isActive } });
                    }}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider ${rule.isActive ? "bg-zinc-100 text-zinc-700 hover:bg-zinc-200" : "bg-red-50 text-red-600 hover:bg-red-100"}`}
                  >
                    {rule.isActive ? "Вкл" : "Выкл"}
                  </button>
                  <button
                    onClick={() => {
                      void updatePointsRule.mutateAsync({ id: rule.id, patch: { isAuto: !rule.isAuto } });
                    }}
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-zinc-700 hover:bg-zinc-50 shadow-sm transition"
                  >
                    {rule.isAuto ? "Авто" : "Ручн."}
                  </button>
                </div>
              ))}
            </div>
          </Card>

          <Card className="border border-zinc-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-base font-bold text-zinc-900 tracking-tight">Акции и бонусы</h3>
            <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-4">
              <input value={pointsCampaignDraft.name} onChange={(event) => setPointsCampaignDraft((prev) => ({ ...prev, name: event.target.value }))} placeholder="Название акции" className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400" />
              <input value={pointsCampaignDraft.actionKey} onChange={(event) => setPointsCampaignDraft((prev) => ({ ...prev, actionKey: event.target.value }))} placeholder="action_key или пусто=все" className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400" />
              <input value={pointsCampaignDraft.bonusPoints} onChange={(event) => setPointsCampaignDraft((prev) => ({ ...prev, bonusPoints: event.target.value }))} placeholder="Бонус (+/-)" className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400" />
              <input value={pointsCampaignDraft.multiplier} onChange={(event) => setPointsCampaignDraft((prev) => ({ ...prev, multiplier: event.target.value }))} placeholder="Множитель (1.0)" className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400" />
              <input type="datetime-local" value={pointsCampaignDraft.startsAt} onChange={(event) => setPointsCampaignDraft((prev) => ({ ...prev, startsAt: event.target.value }))} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400" />
              <input type="datetime-local" value={pointsCampaignDraft.endsAt} onChange={(event) => setPointsCampaignDraft((prev) => ({ ...prev, endsAt: event.target.value }))} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400" />
              <button
                onClick={async () => {
                  try {
                    await createPointsCampaign.mutateAsync({
                      name: pointsCampaignDraft.name.trim(),
                      description: pointsCampaignDraft.description.trim() || undefined,
                      actionKey: pointsCampaignDraft.actionKey.trim() || null,
                      bonusPoints: Number(pointsCampaignDraft.bonusPoints),
                      multiplier: Number(pointsCampaignDraft.multiplier || "1"),
                      startsAt: new Date(pointsCampaignDraft.startsAt).toISOString(),
                      endsAt: new Date(pointsCampaignDraft.endsAt).toISOString(),
                      isActive: true,
                    });
                    setPointsCampaignDraft({
                      name: "",
                      description: "",
                      actionKey: "",
                      bonusPoints: "0",
                      multiplier: "1",
                      startsAt: "",
                      endsAt: "",
                    });
                    showToast("success", "Акция добавлена");
                  } catch (error) {
                    showToast("error", extractErrorMessage(error));
                  }
                }}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800"
              >
                Добавить акцию
              </button>
            </div>
            <textarea value={pointsCampaignDraft.description} onChange={(event) => setPointsCampaignDraft((prev) => ({ ...prev, description: event.target.value }))} placeholder="Описание акции" className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 resize-none" />
            <div className="mt-4 space-y-3">
              {(pointsCampaigns.data ?? []).map((campaign) => (
                <div key={campaign.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-100 bg-zinc-50/50 p-4 transition hover:border-zinc-200">
                  <div>
                    <p className="font-bold text-zinc-900">{campaign.name}</p>
                    <p className="text-xs font-semibold text-zinc-500 mt-0.5">{campaign.actionKey ?? "Все действия"} • {new Date(campaign.startsAt).toLocaleString()} - {new Date(campaign.endsAt).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-lg bg-white border border-zinc-200 px-2 py-1 text-xs font-bold text-zinc-800 shadow-sm">+{campaign.bonusPoints} / x{campaign.multiplier}</span>
                    <button
                      onClick={() => {
                        void updatePointsCampaign.mutateAsync({ id: campaign.id, patch: { isActive: !campaign.isActive } });
                      }}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider ${campaign.isActive ? "bg-zinc-100 text-zinc-700 hover:bg-zinc-200" : "bg-red-50 text-red-600 hover:bg-red-100"}`}
                    >
                      {campaign.isActive ? "Активна" : "Отключена"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="border border-zinc-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-base font-bold text-zinc-900 tracking-tight">Ручная корректировка баллов</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <select value={pointsAwardDraft.userId} onChange={(event) => setPointsAwardDraft((prev) => ({ ...prev, userId: event.target.value }))} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400">
                <option value="">Выберите сотрудника</option>
                {data.users.map((item) => (
                  <option key={String(item.id)} value={String(item.id)}>{item.name}</option>
                ))}
              </select>
              <select value={pointsAwardDraft.actionKey} onChange={(event) => setPointsAwardDraft((prev) => ({ ...prev, actionKey: event.target.value }))} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400">
                {(pointsActions.data ?? []).map((item) => (
                  <option key={item.actionKey} value={item.actionKey}>{item.title}</option>
                ))}
              </select>
              <input value={pointsAwardDraft.basePoints} onChange={(event) => setPointsAwardDraft((prev) => ({ ...prev, basePoints: event.target.value }))} placeholder="Баллы (+/-)" className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400" />
              <button
                onClick={async () => {
                  try {
                    await awardPoints.mutateAsync({
                      userId: pointsAwardDraft.userId,
                      actionKey: pointsAwardDraft.actionKey,
                      basePoints: Number(pointsAwardDraft.basePoints),
                      comment: pointsAwardDraft.comment.trim() || undefined,
                    });
                    setPointsAwardDraft((prev) => ({ ...prev, basePoints: "0", comment: "" }));
                    showToast("success", "Баллы начислены");
                  } catch (error) {
                    showToast("error", extractErrorMessage(error));
                  }
                }}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800"
              >
                Начислить
              </button>
            </div>
            <textarea value={pointsAwardDraft.comment} onChange={(event) => setPointsAwardDraft((prev) => ({ ...prev, comment: event.target.value }))} placeholder="Комментарий к начислению" className="mt-4 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 resize-none" />
          </Card>

          <Card className="border border-zinc-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-base font-bold text-zinc-900 tracking-tight">События начисления (последние)</h3>
            <div className="space-y-3">
              {(pointsEvents.data?.items ?? []).map((event) => {
                const employee = data.users.find((userItem) => String(userItem.id) === event.userId);
                return (
                  <div key={event.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 transition hover:border-zinc-200">
                    <div>
                      <p className="font-bold text-zinc-900">{employee?.name ?? event.userId}</p>
                      <p className="text-xs font-semibold text-zinc-500 mt-0.5">{event.actionKey} <span className="mx-1">•</span> {new Date(event.createdAt).toLocaleString()}</p>
                    </div>
                    <span className={`rounded-lg px-2.5 py-1 text-sm font-bold shadow-sm border border-transparent ${event.totalPoints >= 0 ? "bg-zinc-900 text-white" : "bg-red-50 text-red-600 border-red-100"}`}>
                      {event.totalPoints >= 0 ? "+" : ""}{event.totalPoints}
                    </span>
                  </div>
                );
              })}
              {(pointsEvents.data?.items ?? []).length === 0 ? (
                <p className="text-sm font-medium text-zinc-500 text-center py-4 rounded-xl border border-dashed border-zinc-200 bg-zinc-50">Событий пока нет.</p>
              ) : null}
            </div>
          </Card>
        </div>
      ) : null}

      {activeTab === "other" ? (
        <Card className="border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-zinc-900">Журнал действий</h2>
              <p className="mt-1 text-sm text-zinc-500">История изменений в системе</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => audit.refetch()}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
              >
                Обновить
              </button>
              <button
                onClick={handleExportAudit}
                disabled={isExportingAudit}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isExportingAudit ? "Экспорт..." : "Экспорт CSV"}
              </button>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <input
              value={auditAction}
              onChange={(event) => {
                setAuditAction(event.target.value);
                setAuditPage(1);
              }}
              placeholder="Фильтр action, например tasks.update"
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
            />
            <select
              value={auditActorUserId}
              onChange={(event) => {
                setAuditActorUserId(event.target.value);
                setAuditPage(1);
              }}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
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
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
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
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
            />
            <input
              type="date"
              value={auditFromDate}
              onChange={(event) => {
                setAuditFromDate(event.target.value);
                setAuditPage(1);
              }}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
            />
            <input
              type="date"
              value={auditToDate}
              onChange={(event) => {
                setAuditToDate(event.target.value);
                setAuditPage(1);
              }}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
            />
          </div>

          <div className="space-y-3">
            {audit.data?.items.map((row) => (
              <div key={row.id} className="rounded-xl border border-zinc-100 bg-white p-4 text-xs shadow-sm hover:shadow-md transition">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge className="bg-zinc-900 text-white font-semibold border-transparent shadow-none hover:bg-zinc-800">{row.action}</Badge>
                  <Badge className="bg-zinc-100 text-zinc-700 font-medium border-transparent shadow-none">{row.entityType}:{row.entityId}</Badge>
                  <Badge className="bg-zinc-100 text-zinc-700 font-medium border-transparent shadow-none">{RoleLabels[row.actorRole]}</Badge>
                  <span className="text-zinc-500 font-medium">{new Date(row.createdAt).toLocaleString()}</span>
                </div>
                {row.payload ? (
                  <pre className="overflow-x-auto rounded-lg bg-zinc-50 border border-zinc-100 p-3 text-[11px] text-zinc-600 font-mono">
                    {JSON.stringify(row.payload, null, 2)}
                  </pre>
                ) : null}
              </div>
            ))}
            {!audit.isLoading && (audit.data?.items.length ?? 0) === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center bg-zinc-50">
                <p className="text-sm font-medium text-zinc-500">Нет записей по текущему фильтру.</p>
              </div>
            ) : null}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 text-sm font-medium text-zinc-600 bg-zinc-50 p-4 rounded-xl border border-zinc-100">
            <span>
              Всего: <span className="font-bold text-zinc-900">{audit.data?.total ?? 0}</span>. Страница {auditPage} из {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAuditPage((prev) => Math.max(1, prev - 1))}
                disabled={auditPage <= 1}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Назад
              </button>
              <button
                onClick={() => setAuditPage((prev) => (audit.data?.hasMore ? prev + 1 : prev))}
                disabled={!audit.data?.hasMore}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
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

