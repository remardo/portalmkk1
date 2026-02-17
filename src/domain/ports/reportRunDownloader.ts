export interface ReportRunDownloaderPort {
  downloadReportRun(id: number): Promise<Blob>;
}
