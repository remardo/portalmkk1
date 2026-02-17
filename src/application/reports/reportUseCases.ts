import type { ReportRunDownloaderPort } from "../../domain/ports/reportRunDownloader";

type CsvValue = string | number;

export function toCsv(rows: Array<Record<string, CsvValue>>) {
  if (rows.length === 0) {
    return "";
  }

  const headers = Object.keys(rows[0]);
  const escapeCsv = (value: CsvValue) => `"${String(value).replace(/"/g, '""')}"`;
  const body = rows.map((row) => headers.map((header) => escapeCsv(row[header] ?? "")).join(","));
  return [headers.join(","), ...body].join("\n");
}

export function downloadBlob(fileName: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportRowsAsCsv(rows: Array<Record<string, CsvValue>>, fileNamePrefix: string) {
  const csv = toCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const dateStamp = new Date().toISOString().slice(0, 10);
  downloadBlob(`${fileNamePrefix}-${dateStamp}.csv`, blob);
}

export async function downloadReportRunCsv(
  reportRunId: number,
  fileName: string | null,
  downloader: ReportRunDownloaderPort,
) {
  const blob = await downloader.downloadReportRun(reportRunId);
  downloadBlob(fileName ?? `report-run-${reportRunId}.csv`, blob);
}
