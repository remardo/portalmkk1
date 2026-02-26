import {
  BellDot,
  BookText,
  ChevronRight,
  FileSpreadsheet,
  Phone,
  PhoneCall,
  RefreshCcw,
  Search,
  ShieldCheck,
  UserRound,
  WandSparkles,
  X,
} from "lucide-react";
import type { DragEvent } from "react";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import { useAuth } from "../contexts/useAuth";
import {
  useAnalyzeCrmCallMutation,
  useCreateCrmCallMutation,
  useCreateCrmClientMutation,
  useDialCrmCallMutation,
  useCrmClientQuery,
  useCrmClientsQuery,
  useImportCrmClientsMutation,
  usePortalData,
  useUpdateCrmClientMutation,
} from "../hooks/usePortalData";
import type { CrmClient, CrmClientStatus } from "../services/portalRepository";

const statusColumns: Array<{
  value: CrmClientStatus;
  label: string;
  hint: string;
  borderClass: string;
  badgeClass: string;
}> = [
    {
      value: "sleeping",
      label: "Спящие",
      hint: "Нужен первый контакт",
      borderClass: "border-zinc-200",
      badgeClass: "bg-zinc-100 text-zinc-600",
    },
    {
      value: "in_progress",
      label: "В работе",
      hint: "Идут звонки и диалог",
      borderClass: "border-blue-200",
      badgeClass: "bg-blue-50 text-blue-700",
    },
    {
      value: "reactivated",
      label: "Реактивированы",
      hint: "Клиенты вернулись",
      borderClass: "border-zinc-800",
      badgeClass: "bg-zinc-900 text-white",
    },
    {
      value: "lost",
      label: "Потеряны",
      hint: "Закрыты без результата",
      borderClass: "border-red-100",
      badgeClass: "bg-red-50 text-red-600",
    },
    {
      value: "do_not_call",
      label: "Не звонить",
      hint: "Контакт запрещен",
      borderClass: "border-orange-100",
      badgeClass: "bg-orange-50 text-orange-600",
    },
  ];

function parseClientsCsv(input: string) {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const rows = lines.map((line) => line.split(";").map((cell) => cell.trim()));
  const clients: Array<{ fullName: string; phone: string; source?: string; notes?: string }> = [];
  for (const row of rows) {
    if (row.length < 2) continue;
    const [fullName, phone, source, notes] = row;
    if (!fullName || !phone) continue;
    clients.push({ fullName, phone, source, notes });
  }
  return clients;
}

function formatDateTime(value: string | null) {
  if (!value) return "Нет";
  return new Date(value).toLocaleString();
}

export function CRMPage() {
  const { user } = useAuth();
  const { data: portalData } = usePortalData(Boolean(user));

  const [query, setQuery] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<number | undefined>(undefined);
  const [showCreatePanel, setShowCreatePanel] = useState(true);
  const [draggingClientId, setDraggingClientId] = useState<number | null>(null);
  const [draggingClientFromStatus, setDraggingClientFromStatus] = useState<CrmClientStatus | null>(null);
  const [dropStatus, setDropStatus] = useState<CrmClientStatus | null>(null);
  const [optimisticStatuses, setOptimisticStatuses] = useState<Record<number, CrmClientStatus>>({});

  const clientsQuery = useCrmClientsQuery({
    q: query.trim() || undefined,
    limit: 200,
    enabled: Boolean(user),
    refetchIntervalMs: 10_000,
  });

  const clientQuery = useCrmClientQuery(selectedClientId, Boolean(selectedClientId), 8_000);

  const createClient = useCreateCrmClientMutation();
  const importClients = useImportCrmClientsMutation();
  const updateClient = useUpdateCrmClientMutation();
  const createCall = useCreateCrmCallMutation();
  const analyzeCall = useAnalyzeCrmCallMutation();
  const dialCrmCall = useDialCrmCallMutation();

  const [newClient, setNewClient] = useState({
    fullName: "",
    phone: "",
    source: "",
    notes: "",
  });
  const [importText, setImportText] = useState("");
  const [callDraft, setCallDraft] = useState({
    transcriptRaw: "",
    recordingUrl: "",
    provider: "manual" as "asterisk" | "fmc" | "manual",
    scriptContext: "",
  });
  const [asteriskExtension, setAsteriskExtension] = useState("");
  const [dialFeedback, setDialFeedback] = useState<string | null>(null);

  const officesById = useMemo(() => {
    const map = new Map<number, string>();
    for (const office of portalData?.offices ?? []) {
      map.set(office.id, office.name);
    }
    return map;
  }, [portalData?.offices]);

  const usersById = useMemo(() => {
    const map = new Map<string, string>();
    for (const employee of portalData?.users ?? []) {
      map.set(String(employee.id), employee.name);
    }
    return map;
  }, [portalData?.users]);

  const grouped = useMemo(() => {
    const map: Record<CrmClientStatus, CrmClient[]> = {
      sleeping: [],
      in_progress: [],
      reactivated: [],
      lost: [],
      do_not_call: [],
    };
    for (const client of clientsQuery.data?.items ?? []) {
      const optimisticStatus = optimisticStatuses[client.id];
      const effectiveStatus = optimisticStatus ?? client.status;
      map[effectiveStatus].push(client);
    }
    return map;
  }, [clientsQuery.data?.items, optimisticStatuses]);

  const selectedClient = clientQuery.data?.client;

  async function handleCreateClient() {
    if (!newClient.fullName.trim() || !newClient.phone.trim()) return;
    await createClient.mutateAsync({
      fullName: newClient.fullName.trim(),
      phone: newClient.phone.trim(),
      source: newClient.source.trim() || undefined,
      notes: newClient.notes.trim() || undefined,
      status: "sleeping",
    });
    setNewClient({ fullName: "", phone: "", source: "", notes: "" });
  }

  async function handleImportClients() {
    const parsed = parseClientsCsv(importText);
    if (parsed.length === 0) return;
    await importClients.mutateAsync({
      clients: parsed.map((item) => ({
        fullName: item.fullName,
        phone: item.phone,
        source: item.source,
        notes: item.notes,
        status: "sleeping",
      })),
    });
    setImportText("");
  }

  async function handleStatusChange(clientId: number, status: CrmClientStatus) {
    setOptimisticStatuses((prev) => ({ ...prev, [clientId]: status }));
    await updateClient.mutateAsync({ id: clientId, status });
    setOptimisticStatuses((prev) => {
      const next = { ...prev };
      delete next[clientId];
      return next;
    });
  }

  function handleCardDragStart(event: DragEvent<HTMLButtonElement>, clientId: number, status: CrmClientStatus) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(clientId));
    setDraggingClientId(clientId);
    setDraggingClientFromStatus(status);
  }

  function handleCardDragEnd() {
    setDraggingClientId(null);
    setDraggingClientFromStatus(null);
    setDropStatus(null);
  }

  function handleColumnDragOver(event: DragEvent<HTMLDivElement>, status: CrmClientStatus) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropStatus(status);
  }

  async function handleColumnDrop(event: DragEvent<HTMLDivElement>, status: CrmClientStatus) {
    event.preventDefault();
    const fallbackId = Number(event.dataTransfer.getData("text/plain"));
    const clientId = draggingClientId ?? (Number.isFinite(fallbackId) ? fallbackId : null);
    const fromStatus = draggingClientFromStatus;

    setDropStatus(null);
    setDraggingClientId(null);
    setDraggingClientFromStatus(null);

    if (!clientId || !fromStatus || fromStatus === status) {
      return;
    }
    try {
      await handleStatusChange(clientId, status);
    } catch {
      setOptimisticStatuses((prev) => {
        const next = { ...prev };
        delete next[clientId];
        return next;
      });
    }
  }

  async function handleAddManualCall() {
    const clientId = selectedClient?.id;
    if (!clientId || !callDraft.transcriptRaw.trim()) return;
    const created = await createCall.mutateAsync({
      clientId,
      provider: callDraft.provider,
      recordingUrl: callDraft.recordingUrl.trim() || undefined,
      transcriptRaw: callDraft.transcriptRaw.trim(),
    });

    await analyzeCall.mutateAsync({
      callId: created.id,
      transcriptRaw: callDraft.transcriptRaw.trim(),
      scriptContext: callDraft.scriptContext.trim() || undefined,
      createTasks: true,
    });

    await updateClient.mutateAsync({
      id: clientId,
      status: "in_progress",
      lastContactedAt: new Date().toISOString(),
    });

    setCallDraft({ transcriptRaw: "", recordingUrl: "", provider: "manual", scriptContext: "" });
  }

  function handleCall(phone: string) {
    window.open(`tel:${phone.replace(/\s+/g, "")}`, "_self");
  }

  async function handleAsteriskDial() {
    if (!selectedClient) return;
    setDialFeedback(null);
    try {
      const response = await dialCrmCall.mutateAsync({
        clientId: selectedClient.id,
        provider: "asterisk",
        employeeExtension: asteriskExtension.trim() || undefined,
      });
      setDialFeedback(`Звонок поставлен в очередь (${response.actionId}).`);
      await clientQuery.refetch();
      await clientsQuery.refetch();
    } catch (error) {
      setDialFeedback(error instanceof Error ? error.message : "Не удалось отправить звонок в Asterisk");
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">CRM Pipeline</h1>
            <p className="mt-1 text-sm text-zinc-500">Kanban-доска клиентов в стиле amoCRM: стадии, карточки и быстрый звонок.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                void clientsQuery.refetch();
                if (selectedClientId) {
                  void clientQuery.refetch();
                }
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              Обновить
            </button>
            <div className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-semibold text-white shadow-sm">Клиентов: {clientsQuery.data?.total ?? 0}</div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск по имени, телефону, источнику"
              className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
            />
          </label>
          <div className="flex items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
            Автосинхронизация звонков/расшифровок: <span className="ml-1 font-semibold text-zinc-900">включена</span>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:shadow-md">
        <button
          type="button"
          onClick={() => setShowCreatePanel((prev) => !prev)}
          className="mb-3 inline-flex items-center gap-2 rounded-lg border border-transparent px-3 py-1.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
        >
          <ChevronRight className={`h-4 w-4 transition ${showCreatePanel ? "rotate-90" : ""}`} />
          Лиды: добавить / импортировать
        </button>

        {showCreatePanel ? (
          <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr]">
            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900">
                <UserRound className="h-4 w-4 text-zinc-500" />
                Новый клиент
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <input value={newClient.fullName} onChange={(e) => setNewClient((p) => ({ ...p, fullName: e.target.value }))} placeholder="ФИО" className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400" />
                <input value={newClient.phone} onChange={(e) => setNewClient((p) => ({ ...p, phone: e.target.value }))} placeholder="Телефон" className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400" />
                <input value={newClient.source} onChange={(e) => setNewClient((p) => ({ ...p, source: e.target.value }))} placeholder="Источник" className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400" />
                <button type="button" onClick={handleCreateClient} disabled={createClient.isPending} className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60">
                  {createClient.isPending ? "Сохраняю..." : "Создать"}
                </button>
              </div>
              <textarea value={newClient.notes} onChange={(e) => setNewClient((p) => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Комментарий" className="mt-3 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400" />
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 shadow-sm">
              <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-zinc-900">
                <FileSpreadsheet className="h-4 w-4 text-zinc-500" />
                Импорт базы
              </div>
              <p className="mb-3 text-xs text-zinc-500">Формат строк: ФИО;Телефон;Источник;Комментарий</p>
              <textarea value={importText} onChange={(e) => setImportText(e.target.value)} rows={4} placeholder="Иванов Иван; +79990000000; CRM-архив; не отвечал 3 месяца" className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400" />
              <button type="button" onClick={handleImportClients} disabled={importClients.isPending} className="mt-3 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60">
                {importClients.isPending ? "Импорт..." : "Импортировать"}
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 overflow-x-auto pb-2 xl:grid-cols-5" style={{ gridTemplateColumns: "repeat(5, minmax(260px, 1fr))" }}>
        {statusColumns.map((column) => {
          const columnClients = grouped[column.value] ?? [];
          return (
            <div
              key={column.value}
              onDragOver={(event) => handleColumnDragOver(event, column.value)}
              onDrop={(event) => {
                void handleColumnDrop(event, column.value);
              }}
              onDragLeave={() => setDropStatus((prev) => (prev === column.value ? null : prev))}
              className={`min-h-[62vh] rounded-2xl border bg-white shadow-sm transition hover:shadow-md ${dropStatus === column.value ? "ring-2 ring-zinc-300" : ""
                } ${column.borderClass}`}
            >
              <div className="sticky top-0 z-10 rounded-t-2xl border-b border-zinc-100 bg-white/95 px-3 py-3 backdrop-blur">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-zinc-800">{column.label}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${column.badgeClass}`}>{columnClients.length}</span>
                </div>
                <p className="mt-1 text-xs text-zinc-500">{column.hint}</p>
              </div>

              <div className="space-y-2 p-3">
                {columnClients.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-zinc-200 px-3 py-5 text-center text-xs text-zinc-400">Пусто</div>
                ) : (
                  columnClients.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      draggable
                      onDragStart={(event) => handleCardDragStart(event, client.id, client.status)}
                      onDragEnd={handleCardDragEnd}
                      onClick={() => setSelectedClientId(client.id)}
                      className={`w-full rounded-xl border border-zinc-200 bg-white shadow-sm p-4 text-left transition-all hover:-translate-y-0.5 hover:border-zinc-400 hover:shadow-md ${draggingClientId === client.id ? "opacity-60" : ""
                        }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="line-clamp-2 text-sm font-bold text-zinc-900">{client.fullName}</p>
                        <ChevronRight className="h-4 w-4 shrink-0 text-zinc-300" />
                      </div>
                      <p className="mt-1 text-xs font-medium text-zinc-600">{client.phone}</p>
                      <p className="mt-1.5 text-[11px] font-medium text-zinc-500">
                        {client.assignedUserId ? usersById.get(client.assignedUserId) ?? "Исполнитель" : "Без исполнителя"}
                      </p>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="rounded-md bg-zinc-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">{client.source ?? "Без источника"}</span>
                        <span className="text-[10px] font-medium text-zinc-400">{formatDateTime(client.lastContactedAt)}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </section>

      {selectedClient ? (
        <div className="fixed inset-0 z-40">
          <button type="button" className="absolute inset-0 bg-zinc-900/30 backdrop-blur-[2px]" onClick={() => setSelectedClientId(undefined)} />
          <aside className="absolute right-0 top-0 flex h-full w-full max-w-[560px] flex-col border-l border-zinc-200 bg-white shadow-2xl">
            <div className="sticky top-0 z-10 border-b border-zinc-100 bg-white/95 px-5 py-5 backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-zinc-900">{selectedClient.fullName}</h2>
                  <p className="mt-1 text-sm font-medium text-zinc-500">{selectedClient.phone}</p>
                </div>
                <button type="button" onClick={() => setSelectedClientId(undefined)} className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button type="button" onClick={handleAsteriskDial} disabled={dialCrmCall.isPending} className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-60">
                  <Phone className="h-4 w-4" />
                  {dialCrmCall.isPending ? "Звоним..." : "Позвонить через Asterisk"}
                </button>
                <button type="button" onClick={() => handleCall(selectedClient.phone)} className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50">
                  <Phone className="h-4 w-4" />
                  Через softphone (tel:)
                </button>
                <button type="button" onClick={() => { void clientQuery.refetch(); void clientsQuery.refetch(); }} className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 hover:border-zinc-300">
                  <RefreshCcw className="h-4 w-4" />
                  Подтянуть из АТС
                </button>
                <input
                  value={asteriskExtension}
                  onChange={(event) => setAsteriskExtension(event.target.value)}
                  placeholder="Внутренний номер (опц.)"
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
                />
                <select
                  value={selectedClient.status}
                  onChange={(event) => {
                    void handleStatusChange(selectedClient.id, event.target.value as CrmClientStatus);
                  }}
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
                >
                  {statusColumns.map((status) => (
                    <option key={status.value} value={status.value}>{status.label}</option>
                  ))}
                </select>
              </div>
              {dialFeedback ? (
                <p className="mt-2 text-xs font-medium text-zinc-600">{dialFeedback}</p>
              ) : null}
            </div>

            <div className="flex-1 overflow-auto px-5 py-5 space-y-4">
              <Card className="rounded-2xl border border-zinc-200 shadow-sm">
                <CardHeader className="pb-3 border-b border-zinc-100">
                  <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                    <ShieldCheck className="h-4 w-4 text-zinc-500" />
                    Карточка клиента
                  </div>
                </CardHeader>
                <CardContent className="mt-3 space-y-3 text-sm text-zinc-700">
                  <div className="flex items-center justify-between"><span className="text-zinc-500">Офис:</span> <span className="font-medium text-zinc-900">{selectedClient.officeId ? officesById.get(selectedClient.officeId) : "Не задан"}</span></div>
                  <div className="flex items-center justify-between"><span className="text-zinc-500">Ответственный:</span> <span className="font-medium text-zinc-900">{selectedClient.assignedUserId ? usersById.get(selectedClient.assignedUserId) : "Не назначен"}</span></div>
                  <div className="flex items-center justify-between"><span className="text-zinc-500">Последний контакт:</span> <span className="font-medium text-zinc-900">{formatDateTime(selectedClient.lastContactedAt)}</span></div>
                  <div className="pt-2"><span className="block text-zinc-500 mb-1">Комментарий:</span> <span className="block rounded-lg bg-zinc-50 p-3 italic text-zinc-700 font-medium">{selectedClient.notes || "Нет"}</span></div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border border-zinc-200 bg-white shadow-sm lg:col-span-1">
                <CardHeader className="pb-3 border-b border-zinc-100">
                  <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                    <PhoneCall className="h-4 w-4 text-zinc-500" />
                    Ручной звонок + QA
                  </div>
                </CardHeader>
                <CardContent className="mt-3 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <select value={callDraft.provider} onChange={(event) => setCallDraft((prev) => ({ ...prev, provider: event.target.value as "asterisk" | "fmc" | "manual" }))} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400">
                      <option value="manual">Manual</option>
                      <option value="asterisk">Asterisk</option>
                      <option value="fmc">FMC</option>
                    </select>
                    <input value={callDraft.recordingUrl} onChange={(event) => setCallDraft((prev) => ({ ...prev, recordingUrl: event.target.value }))} placeholder="URL записи" className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400" />
                  </div>
                  <textarea value={callDraft.transcriptRaw} onChange={(event) => setCallDraft((prev) => ({ ...prev, transcriptRaw: event.target.value }))} rows={4} placeholder="Расшифровка звонка" className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400" />
                  <textarea value={callDraft.scriptContext} onChange={(event) => setCallDraft((prev) => ({ ...prev, scriptContext: event.target.value }))} rows={2} placeholder="Скрипт для проверки" className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400" />
                  <button type="button" onClick={handleAddManualCall} disabled={createCall.isPending || analyzeCall.isPending || !callDraft.transcriptRaw.trim()} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60">
                    <WandSparkles className="h-4 w-4" />
                    {analyzeCall.isPending ? "Анализ..." : "Сохранить звонок"}
                  </button>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
                <CardHeader className="pb-3 border-b border-zinc-100">
                  <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                    <BookText className="h-4 w-4 text-zinc-500" />
                    История звонков и расшифровок
                  </div>
                </CardHeader>
                <CardContent className="mt-3 space-y-3">
                  {(clientQuery.data?.calls ?? []).length === 0 ? (
                    <p className="text-sm rounded-lg bg-zinc-50 p-4 text-center text-zinc-500">Пока нет звонков. После звонка через Asterisk/FMC карточка обновится автоматически.</p>
                  ) : (
                    clientQuery.data!.calls.map((call) => {
                      const evaluation = clientQuery.data!.evaluations.find((item) => item.callId === call.id);
                      return (
                        <div key={call.id} className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 transition hover:bg-zinc-50">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-zinc-900">#{call.id} • {call.provider.toUpperCase()} • {formatDateTime(call.createdAt)}</p>
                            <span className="rounded-md bg-white border border-zinc-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-600 shadow-sm">QA: {evaluation ? `${evaluation.overallScore}/100` : "нет"}</span>
                          </div>
                          <p className="mt-2 text-sm text-zinc-700">{call.transcriptSummaryShort || "Сводка еще не готова"}</p>
                          {evaluation ? (
                            <p className="mt-2 text-xs font-medium text-zinc-500">Скрипт: <span className="text-zinc-700">{evaluation.scriptComplianceScore}/100</span> • Подача: <span className="text-zinc-700">{evaluation.deliveryScore}/100</span></p>
                          ) : null}
                          {call.recordingUrl ? (
                            <a href={call.recordingUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline">
                              <BellDot className="h-3.5 w-3.5" />
                              Открыть запись
                            </a>
                          ) : null}
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
