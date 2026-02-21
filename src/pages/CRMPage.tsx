import { PhoneCall, Upload, UserRound, WandSparkles, FileSpreadsheet, PhoneForwarded } from "lucide-react";
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
import type { CrmClientStatus } from "../services/portalRepository";

const statusOptions: Array<{ value: CrmClientStatus; label: string }> = [
  { value: "sleeping", label: "Спящий" },
  { value: "in_progress", label: "В работе" },
  { value: "reactivated", label: "Реактивирован" },
  { value: "lost", label: "Потерян" },
  { value: "do_not_call", label: "Не звонить" },
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

export function CRMPage() {
  const { user } = useAuth();
  const { data: portalData } = usePortalData(Boolean(user));
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<CrmClientStatus | "all">("sleeping");
  const [selectedClientId, setSelectedClientId] = useState<number | undefined>(undefined);

  const clientsQuery = useCrmClientsQuery({
    q: query.trim() || undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
    limit: 100,
    enabled: Boolean(user),
  });

  const selectedFromList = clientsQuery.data?.items.find((item) => item.id === selectedClientId);
  const resolvedClientId = selectedClientId ?? selectedFromList?.id;
  const clientQuery = useCrmClientQuery(resolvedClientId, Boolean(resolvedClientId));

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
    status: "sleeping" as CrmClientStatus,
  });
  const [importText, setImportText] = useState("");
  const [callDraft, setCallDraft] = useState({
    transcriptRaw: "",
    recordingUrl: "",
    provider: "manual" as "asterisk" | "fmc" | "manual",
  });
  const [scriptContext, setScriptContext] = useState("");

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

  async function handleCreateClient() {
    if (!newClient.fullName.trim() || !newClient.phone.trim()) return;
    await createClient.mutateAsync({
      fullName: newClient.fullName.trim(),
      phone: newClient.phone.trim(),
      source: newClient.source.trim() || undefined,
      notes: newClient.notes.trim() || undefined,
      status: newClient.status,
    });
    setNewClient({ fullName: "", phone: "", source: "", notes: "", status: "sleeping" });
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

  async function handleCreateAndAnalyzeCall() {
    const clientId = clientQuery.data?.client.id;
    if (!clientId) return;
    const created = (await createCall.mutateAsync({
      clientId,
      provider: callDraft.provider,
      recordingUrl: callDraft.recordingUrl.trim() || undefined,
      transcriptRaw: callDraft.transcriptRaw.trim() || undefined,
    })) as { id?: number } | undefined;

    const callId = Number(created?.id);
    if (!Number.isFinite(callId) || callId <= 0) return;

    await analyzeCall.mutateAsync({
      callId,
      transcriptRaw: callDraft.transcriptRaw.trim() || undefined,
      scriptContext: scriptContext.trim() || undefined,
      createTasks: true,
    });

    await updateClient.mutateAsync({
      id: clientId,
      status: "in_progress",
      lastContactedAt: new Date().toISOString(),
    });

    setCallDraft({ transcriptRaw: "", recordingUrl: "", provider: "manual" });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-teal-50 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">CRM: спящие клиенты</h1>
            <p className="mt-1 text-sm text-slate-600">
              Загрузка базы, звонки через Asterisk/FMC и авто-анализ разговоров с задачами.
            </p>
          </div>
          <div className="rounded-2xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white">
            Клиентов: {clientsQuery.data?.total ?? 0}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_1.4fr]">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <UserRound className="h-4 w-4 text-cyan-600" />
              База клиентов
            </div>
            <div className="flex items-center gap-2">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Поиск: имя, телефон"
                className="w-44 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-cyan-400"
              />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as CrmClientStatus | "all")}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-cyan-400"
              >
                <option value="all">Все статусы</option>
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                value={newClient.fullName}
                onChange={(event) => setNewClient((prev) => ({ ...prev, fullName: event.target.value }))}
                placeholder="ФИО"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-400"
              />
              <input
                value={newClient.phone}
                onChange={(event) => setNewClient((prev) => ({ ...prev, phone: event.target.value }))}
                placeholder="Телефон"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-400"
              />
              <input
                value={newClient.source}
                onChange={(event) => setNewClient((prev) => ({ ...prev, source: event.target.value }))}
                placeholder="Источник"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-400"
              />
              <select
                value={newClient.status}
                onChange={(event) => setNewClient((prev) => ({ ...prev, status: event.target.value as CrmClientStatus }))}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-400"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              value={newClient.notes}
              onChange={(event) => setNewClient((prev) => ({ ...prev, notes: event.target.value }))}
              placeholder="Комментарий"
              rows={2}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-400"
            />
            <button
              type="button"
              onClick={handleCreateClient}
              disabled={createClient.isPending}
              className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:opacity-50"
            >
              {createClient.isPending ? "Создание..." : "Добавить клиента"}
            </button>

            <div className="rounded-2xl border border-cyan-100 bg-cyan-50/50 p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-cyan-800">
                <Upload className="h-4 w-4" />
                Импорт списка спящих клиентов
              </div>
              <p className="mb-2 text-xs text-cyan-700">Формат строки: ФИО;Телефон;Источник;Комментарий</p>
              <textarea
                value={importText}
                onChange={(event) => setImportText(event.target.value)}
                rows={4}
                placeholder="Иванов Иван; +79990000000; CRM-архив; не отвечал 3 месяца"
                className="w-full rounded-xl border border-cyan-200 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-400"
              />
              <button
                type="button"
                onClick={handleImportClients}
                disabled={importClients.isPending}
                className="mt-2 inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
              >
                <FileSpreadsheet className="h-4 w-4" />
                {importClients.isPending ? "Импорт..." : "Импортировать"}
              </button>
            </div>

            <div className="max-h-[380px] space-y-2 overflow-auto pr-1">
              {(clientsQuery.data?.items ?? []).map((client) => {
                const selected = client.id === resolvedClientId;
                return (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => setSelectedClientId(client.id)}
                    className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                      selected ? "border-cyan-300 bg-cyan-50" : "border-slate-200 bg-white hover:border-cyan-200"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{client.fullName}</p>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        {statusOptions.find((item) => item.value === client.status)?.label ?? client.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{client.phone}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {client.officeId ? officesById.get(client.officeId) : "Офис не задан"}
                      {client.assignedUserId ? ` • ${usersById.get(client.assignedUserId) ?? "Исполнитель"}` : ""}
                    </p>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <PhoneCall className="h-4 w-4 text-teal-600" />
              Карточка клиента и звонки
            </div>
          </CardHeader>
          <CardContent>
            {!clientQuery.data?.client ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500">
                Выберите клиента слева
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">{clientQuery.data.client.fullName}</h3>
                      <p className="text-sm text-slate-600">{clientQuery.data.client.phone}</p>
                    </div>
                    <select
                      value={clientQuery.data.client.status}
                      onChange={async (event) => {
                        await updateClient.mutateAsync({
                          id: clientQuery.data!.client.id,
                          status: event.target.value as CrmClientStatus,
                        });
                      }}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-400"
                    >
                      {statusOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Последний контакт: {clientQuery.data.client.lastContactedAt ? new Date(clientQuery.data.client.lastContactedAt).toLocaleString() : "еще не было"}
                  </p>
                  {clientQuery.data.client.notes ? (
                    <p className="mt-2 text-sm text-slate-700">{clientQuery.data.client.notes}</p>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-cyan-200 bg-cyan-50/40 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-cyan-900">
                    <PhoneForwarded className="h-4 w-4" />
                    Добавить звонок и запустить анализ
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <select
                      value={callDraft.provider}
                      onChange={(event) => setCallDraft((prev) => ({ ...prev, provider: event.target.value as "asterisk" | "fmc" | "manual" }))}
                      className="rounded-xl border border-cyan-200 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-400"
                    >
                      <option value="manual">Manual</option>
                      <option value="asterisk">Asterisk</option>
                      <option value="fmc">FMC</option>
                    </select>
                    <input
                      value={callDraft.recordingUrl}
                      onChange={(event) => setCallDraft((prev) => ({ ...prev, recordingUrl: event.target.value }))}
                      placeholder="URL записи (опционально)"
                      className="rounded-xl border border-cyan-200 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-400"
                    />
                  </div>
                  <textarea
                    value={callDraft.transcriptRaw}
                    onChange={(event) => setCallDraft((prev) => ({ ...prev, transcriptRaw: event.target.value }))}
                    rows={5}
                    placeholder="Вставьте расшифровку разговора"
                    className="mt-2 w-full rounded-xl border border-cyan-200 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-400"
                  />
                  <textarea
                    value={scriptContext}
                    onChange={(event) => setScriptContext(event.target.value)}
                    rows={2}
                    placeholder="Скрипт/стандарт для проверки (опционально)"
                    className="mt-2 w-full rounded-xl border border-cyan-200 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-400"
                  />
                  <button
                    type="button"
                    onClick={handleCreateAndAnalyzeCall}
                    disabled={createCall.isPending || analyzeCall.isPending || !callDraft.transcriptRaw.trim()}
                    className="mt-2 inline-flex items-center gap-2 rounded-xl bg-cyan-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:opacity-50"
                  >
                    <WandSparkles className="h-4 w-4" />
                    {analyzeCall.isPending ? "Анализ..." : "Добавить звонок + анализ"}
                  </button>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-slate-700">История звонков</h4>
                  {(clientQuery.data.calls ?? []).length === 0 ? (
                    <p className="text-sm text-slate-500">Звонков пока нет.</p>
                  ) : (
                    clientQuery.data.calls.map((call) => {
                      const evaluation = clientQuery.data!.evaluations.find((item) => item.callId === call.id);
                      return (
                        <div key={call.id} className="rounded-2xl border border-slate-200 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-900">
                              #{call.id} • {call.provider.toUpperCase()} • {call.createdAt.slice(0, 16).replace("T", " ")}
                            </p>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                              QA: {evaluation ? `${evaluation.overallScore}/100` : "нет"}
                            </span>
                          </div>
                          {call.transcriptSummaryShort ? (
                            <p className="mt-2 text-sm text-slate-700">{call.transcriptSummaryShort}</p>
                          ) : (
                            <p className="mt-2 text-sm text-slate-500">Нет краткого саммари.</p>
                          )}
                          {evaluation ? (
                            <p className="mt-2 text-xs text-slate-600">
                              Скрипт: {evaluation.scriptComplianceScore}/100 • Подача: {evaluation.deliveryScore}/100
                            </p>
                          ) : null}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
