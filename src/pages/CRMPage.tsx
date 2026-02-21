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
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import { useAuth } from "../contexts/useAuth";
import {
  useAnalyzeCrmCallMutation,
  useCreateCrmCallMutation,
  useCreateCrmClientMutation,
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
    borderClass: "border-slate-200",
    badgeClass: "bg-slate-100 text-slate-700",
  },
  {
    value: "in_progress",
    label: "В работе",
    hint: "Идут звонки и диалог",
    borderClass: "border-cyan-200",
    badgeClass: "bg-cyan-100 text-cyan-700",
  },
  {
    value: "reactivated",
    label: "Реактивированы",
    hint: "Клиенты вернулись",
    borderClass: "border-emerald-200",
    badgeClass: "bg-emerald-100 text-emerald-700",
  },
  {
    value: "lost",
    label: "Потеряны",
    hint: "Закрыты без результата",
    borderClass: "border-rose-200",
    badgeClass: "bg-rose-100 text-rose-700",
  },
  {
    value: "do_not_call",
    label: "Не звонить",
    hint: "Контакт запрещен",
    borderClass: "border-amber-200",
    badgeClass: "bg-amber-100 text-amber-700",
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
      map[client.status].push(client);
    }
    return map;
  }, [clientsQuery.data?.items]);

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
    await updateClient.mutateAsync({ id: clientId, status });
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

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-cyan-200 bg-[radial-gradient(circle_at_12%_20%,rgba(45,212,191,0.2),transparent_40%),radial-gradient(circle_at_95%_10%,rgba(34,211,238,0.2),transparent_35%),linear-gradient(160deg,#f7fcfd,#ecfeff)] p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">CRM Pipeline</h1>
            <p className="mt-1 text-sm text-slate-600">Kanban-доска клиентов в стиле amoCRM: стадии, карточки и быстрый звонок.</p>
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
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-200 bg-white px-3 py-2 text-xs font-semibold text-cyan-800 hover:bg-cyan-50"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              Обновить
            </button>
            <div className="rounded-xl bg-cyan-700 px-3 py-2 text-sm font-semibold text-white">Клиентов: {clientsQuery.data?.total ?? 0}</div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск по имени, телефону, источнику"
              className="w-full rounded-xl border border-cyan-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-cyan-400"
            />
          </label>
          <div className="rounded-xl border border-cyan-200 bg-white px-3 py-2 text-xs text-slate-600">
            Автосинхронизация звонков/расшифровок: <span className="font-semibold text-cyan-700">включена</span>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <button
          type="button"
          onClick={() => setShowCreatePanel((prev) => !prev)}
          className="mb-3 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <ChevronRight className={`h-4 w-4 transition ${showCreatePanel ? "rotate-90" : ""}`} />
          Лиды: добавить / импортировать
        </button>

        {showCreatePanel ? (
          <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr]">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <UserRound className="h-4 w-4 text-cyan-700" />
                Новый клиент
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <input value={newClient.fullName} onChange={(e) => setNewClient((p) => ({ ...p, fullName: e.target.value }))} placeholder="ФИО" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-400" />
                <input value={newClient.phone} onChange={(e) => setNewClient((p) => ({ ...p, phone: e.target.value }))} placeholder="Телефон" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-400" />
                <input value={newClient.source} onChange={(e) => setNewClient((p) => ({ ...p, source: e.target.value }))} placeholder="Источник" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-400" />
                <button type="button" onClick={handleCreateClient} disabled={createClient.isPending} className="rounded-lg bg-cyan-700 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-800 disabled:opacity-60">
                  {createClient.isPending ? "Сохраняю..." : "Создать"}
                </button>
              </div>
              <textarea value={newClient.notes} onChange={(e) => setNewClient((p) => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Комментарий" className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-400" />
            </div>

            <div className="rounded-xl border border-cyan-200 bg-cyan-50/50 p-3">
              <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-cyan-800">
                <FileSpreadsheet className="h-4 w-4" />
                Импорт базы
              </div>
              <p className="mb-2 text-xs text-cyan-700">Формат строк: ФИО;Телефон;Источник;Комментарий</p>
              <textarea value={importText} onChange={(e) => setImportText(e.target.value)} rows={4} placeholder="Иванов Иван; +79990000000; CRM-архив; не отвечал 3 месяца" className="w-full rounded-lg border border-cyan-200 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-400" />
              <button type="button" onClick={handleImportClients} disabled={importClients.isPending} className="mt-2 rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60">
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
            <div key={column.value} className={`min-h-[62vh] rounded-2xl border bg-white ${column.borderClass}`}>
              <div className="sticky top-0 z-10 rounded-t-2xl border-b border-slate-100 bg-white/95 px-3 py-3 backdrop-blur">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-800">{column.label}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${column.badgeClass}`}>{columnClients.length}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{column.hint}</p>
              </div>

              <div className="space-y-2 p-3">
                {columnClients.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 px-3 py-5 text-center text-xs text-slate-400">Пусто</div>
                ) : (
                  columnClients.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => setSelectedClientId(client.id)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-cyan-300 hover:bg-white"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="line-clamp-2 text-sm font-semibold text-slate-800">{client.fullName}</p>
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                      </div>
                      <p className="mt-1 text-xs text-slate-600">{client.phone}</p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {client.assignedUserId ? usersById.get(client.assignedUserId) ?? "Исполнитель" : "Без исполнителя"}
                      </p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-slate-500">{client.source ?? "Без источника"}</span>
                        <span className="text-[11px] text-slate-400">{formatDateTime(client.lastContactedAt)}</span>
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
          <button type="button" className="absolute inset-0 bg-slate-900/35" onClick={() => setSelectedClientId(undefined)} />
          <aside className="absolute right-0 top-0 h-full w-full max-w-[560px] overflow-auto border-l border-slate-200 bg-white shadow-2xl">
            <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">{selectedClient.fullName}</h2>
                  <p className="mt-1 text-sm text-slate-600">{selectedClient.phone}</p>
                </div>
                <button type="button" onClick={() => setSelectedClientId(undefined)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => handleCall(selectedClient.phone)} className="inline-flex items-center gap-2 rounded-lg bg-cyan-700 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-800">
                  <Phone className="h-4 w-4" />
                  Позвонить
                </button>
                <button type="button" onClick={() => { void clientQuery.refetch(); void clientsQuery.refetch(); }} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  <RefreshCcw className="h-4 w-4" />
                  Подтянуть из АТС
                </button>
                <select
                  value={selectedClient.status}
                  onChange={(event) => {
                    void handleStatusChange(selectedClient.id, event.target.value as CrmClientStatus);
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-cyan-400"
                >
                  {statusColumns.map((status) => (
                    <option key={status.value} value={status.value}>{status.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-4 px-5 py-4">
              <Card className="border-slate-200">
                <CardHeader>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <ShieldCheck className="h-4 w-4 text-cyan-700" />
                    Карточка клиента
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-slate-700">
                  <p><span className="text-slate-500">Офис:</span> {selectedClient.officeId ? officesById.get(selectedClient.officeId) : "Не задан"}</p>
                  <p><span className="text-slate-500">Ответственный:</span> {selectedClient.assignedUserId ? usersById.get(selectedClient.assignedUserId) : "Не назначен"}</p>
                  <p><span className="text-slate-500">Последний контакт:</span> {formatDateTime(selectedClient.lastContactedAt)}</p>
                  <p><span className="text-slate-500">Комментарий:</span> {selectedClient.notes || "Нет"}</p>
                </CardContent>
              </Card>

              <Card className="border-cyan-200">
                <CardHeader>
                  <div className="flex items-center gap-2 text-sm font-semibold text-cyan-800">
                    <PhoneCall className="h-4 w-4" />
                    Ручной звонок + QA
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <select value={callDraft.provider} onChange={(event) => setCallDraft((prev) => ({ ...prev, provider: event.target.value as "asterisk" | "fmc" | "manual" }))} className="rounded-lg border border-cyan-200 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-400">
                      <option value="manual">Manual</option>
                      <option value="asterisk">Asterisk</option>
                      <option value="fmc">FMC</option>
                    </select>
                    <input value={callDraft.recordingUrl} onChange={(event) => setCallDraft((prev) => ({ ...prev, recordingUrl: event.target.value }))} placeholder="URL записи" className="rounded-lg border border-cyan-200 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-400" />
                  </div>
                  <textarea value={callDraft.transcriptRaw} onChange={(event) => setCallDraft((prev) => ({ ...prev, transcriptRaw: event.target.value }))} rows={4} placeholder="Расшифровка звонка" className="w-full rounded-lg border border-cyan-200 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-400" />
                  <textarea value={callDraft.scriptContext} onChange={(event) => setCallDraft((prev) => ({ ...prev, scriptContext: event.target.value }))} rows={2} placeholder="Скрипт для проверки" className="w-full rounded-lg border border-cyan-200 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-400" />
                  <button type="button" onClick={handleAddManualCall} disabled={createCall.isPending || analyzeCall.isPending || !callDraft.transcriptRaw.trim()} className="inline-flex items-center gap-2 rounded-lg bg-cyan-700 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-800 disabled:opacity-60">
                    <WandSparkles className="h-4 w-4" />
                    {analyzeCall.isPending ? "Анализ..." : "Сохранить звонок"}
                  </button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <BookText className="h-4 w-4 text-teal-700" />
                    История звонков и расшифровок
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(clientQuery.data?.calls ?? []).length === 0 ? (
                    <p className="text-sm text-slate-500">Пока нет звонков. После звонка через Asterisk/FMC карточка обновится автоматически.</p>
                  ) : (
                    clientQuery.data!.calls.map((call) => {
                      const evaluation = clientQuery.data!.evaluations.find((item) => item.callId === call.id);
                      return (
                        <div key={call.id} className="rounded-xl border border-slate-200 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-800">#{call.id} • {call.provider.toUpperCase()} • {formatDateTime(call.createdAt)}</p>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">QA: {evaluation ? `${evaluation.overallScore}/100` : "нет"}</span>
                          </div>
                          <p className="mt-2 text-sm text-slate-700">{call.transcriptSummaryShort || "Сводка еще не готова"}</p>
                          {evaluation ? (
                            <p className="mt-2 text-xs text-slate-500">Скрипт: {evaluation.scriptComplianceScore}/100 • Подача: {evaluation.deliveryScore}/100</p>
                          ) : null}
                          {call.recordingUrl ? (
                            <a href={call.recordingUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-cyan-700 hover:underline">
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
