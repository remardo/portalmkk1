import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Task } from "../domain/models";
import {
  type AdminAuditList,
  type AdminCreateUserInput,
  type AdminSloStatus,
  type AdminUpdateUserInput,
  type KpiReport,
  portalRepository,
  type ReportDeliveryRun,
  type ReportDeliverySchedule,
  type ReportsDrilldown,
  type SloRoutingPolicy,
  type UnifiedSearchResult,
  type CreateDocumentInput,
  type CreateCourseAttemptInput,
  type SubmitCourseAnswersInput,
  type CreateKbArticleInput,
  type CreateNewsInput,
  type CreateCourseInput,
  type DocumentDecisionInput,
  type RestoreKbArticleVersionInput,
  type CreateTaskInput,
  type UpdateNewsInput,
  type UpdateKbArticleInput,
  type UpdateCourseInput,
  type UpdateTaskInput,
} from "../services/portalRepository";

export const portalDataQueryKey = ["portal-data"] as const;

export function usePortalData(enabled = true) {
  return useQuery({
    queryKey: portalDataQueryKey,
    queryFn: () => portalRepository.getData(),
    enabled,
  });
}

export function useUpdateTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (task: { id: number; status: Task["status"] }) => portalRepository.updateTaskStatus(task),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: portalDataQueryKey }),
  });
}

export function useEditTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (task: UpdateTaskInput) => portalRepository.updateTask(task),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: portalDataQueryKey }),
  });
}

export function useDeleteTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => portalRepository.deleteTask(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: portalDataQueryKey }),
  });
}

export function useCreateTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (task: CreateTaskInput) => portalRepository.createTask(task),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: portalDataQueryKey }),
  });
}

export function useCreateNewsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (news: CreateNewsInput) => portalRepository.createNews(news),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: portalDataQueryKey }),
  });
}

export function useUpdateNewsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateNewsInput) => portalRepository.updateNews(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: portalDataQueryKey }),
  });
}

export function useDeleteNewsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => portalRepository.deleteNews(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: portalDataQueryKey }),
  });
}

export function useCreateDocumentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (document: CreateDocumentInput) => portalRepository.createDocument(document),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: portalDataQueryKey }),
  });
}

export function useSubmitDocumentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => portalRepository.submitDocument(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: portalDataQueryKey }),
  });
}

export function useApproveDocumentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: DocumentDecisionInput) => portalRepository.approveDocument(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: portalDataQueryKey }),
  });
}

export function useRejectDocumentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: DocumentDecisionInput) => portalRepository.rejectDocument(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: portalDataQueryKey }),
  });
}

export function useCreateKbArticleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateKbArticleInput) => portalRepository.createKbArticle(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: portalDataQueryKey }),
  });
}

export function useUpdateKbArticleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateKbArticleInput) => portalRepository.updateKbArticle(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: portalDataQueryKey }),
  });
}

export function useRestoreKbArticleVersionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RestoreKbArticleVersionInput) => portalRepository.restoreKbArticleVersion(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: portalDataQueryKey }),
  });
}

export function useCreateCourseMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCourseInput) => portalRepository.createCourse(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: portalDataQueryKey }),
  });
}

export function useUpdateCourseMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateCourseInput) => portalRepository.updateCourse(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: portalDataQueryKey }),
  });
}

export function useAssignCourseMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { courseId: number; userIds: string[]; dueDate?: string }) =>
      portalRepository.assignCourse(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: portalDataQueryKey }),
  });
}

export function useCreateCourseAttemptMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCourseAttemptInput) => portalRepository.createCourseAttempt(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: portalDataQueryKey }),
  });
}

export function useSubmitCourseAnswersMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SubmitCourseAnswersInput) => portalRepository.submitCourseAnswers(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: portalDataQueryKey }),
  });
}

export function useCourseQuestionsQuery(courseId?: number) {
  return useQuery({
    queryKey: ["course-questions", courseId],
    queryFn: () => {
      if (!courseId) {
        throw new Error("Missing course id");
      }
      return portalRepository.getCourseQuestions(courseId);
    },
    enabled: Boolean(courseId),
  });
}

export function useAdminCreateUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AdminCreateUserInput) => portalRepository.adminCreateUser(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: portalDataQueryKey }),
  });
}

export function useAdminUpdateUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AdminUpdateUserInput) => portalRepository.adminUpdateUser(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: portalDataQueryKey }),
  });
}

export function useAdminAuditQuery(input?: {
  limit?: number;
  offset?: number;
  actorUserId?: string;
  action?: string;
  entityType?: string;
  fromDate?: string;
  toDate?: string;
  enabled?: boolean;
}) {
  return useQuery<AdminAuditList>({
    queryKey: [
      "admin-audit",
      input?.limit ?? 50,
      input?.offset ?? 0,
      input?.actorUserId ?? "",
      input?.action ?? "",
      input?.entityType ?? "",
      input?.fromDate ?? "",
      input?.toDate ?? "",
    ],
    queryFn: () => portalRepository.adminGetAudit(input),
    enabled: input?.enabled ?? true,
  });
}

export function useRunOpsEscalationsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => portalRepository.runOpsEscalations(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: portalDataQueryKey }),
  });
}

export function useRunOpsRemindersMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => portalRepository.runOpsReminders(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: portalDataQueryKey }),
  });
}

export function useAdminSloStatusQuery(input?: { windowMinutes?: number; enabled?: boolean }) {
  return useQuery<AdminSloStatus>({
    queryKey: ["admin-slo-status", input?.windowMinutes ?? "default"],
    queryFn: () => portalRepository.getAdminSloStatus(input?.windowMinutes),
    enabled: input?.enabled ?? true,
    refetchInterval: 60_000,
  });
}

export function useRunOpsSloCheckMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (windowMinutes?: number) => portalRepository.runOpsSloCheck(windowMinutes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-slo-status"] });
      queryClient.invalidateQueries({ queryKey: ["slo-routing-policies"] });
      queryClient.invalidateQueries({ queryKey: ["admin-audit"] });
      queryClient.invalidateQueries({ queryKey: portalDataQueryKey });
    },
  });
}

export function useSloRoutingPoliciesQuery(enabled = true) {
  return useQuery<SloRoutingPolicy[]>({
    queryKey: ["slo-routing-policies"],
    queryFn: () => portalRepository.getSloRoutingPolicies(),
    enabled,
  });
}

export function useCreateSloRoutingPolicyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name: string;
      breachType: "any" | "api_error_rate" | "api_latency_p95" | "notification_failure_rate";
      severity: "any" | "warning" | "critical";
      channels: Array<"webhook" | "email" | "messenger">;
      priority?: number;
      isActive?: boolean;
    }) => portalRepository.createSloRoutingPolicy(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["slo-routing-policies"] });
      queryClient.invalidateQueries({ queryKey: ["admin-audit"] });
    },
  });
}

export function useUpdateSloRoutingPolicyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: number;
      patch: {
        name?: string;
        breachType?: "any" | "api_error_rate" | "api_latency_p95" | "notification_failure_rate";
        severity?: "any" | "warning" | "critical";
        channels?: Array<"webhook" | "email" | "messenger">;
        priority?: number;
        isActive?: boolean;
      };
    }) => portalRepository.updateSloRoutingPolicy(input.id, input.patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["slo-routing-policies"] });
      queryClient.invalidateQueries({ queryKey: ["admin-audit"] });
    },
  });
}

export function useDeleteSloRoutingPolicyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => portalRepository.deleteSloRoutingPolicy(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["slo-routing-policies"] });
      queryClient.invalidateQueries({ queryKey: ["admin-audit"] });
    },
  });
}

export function useReadNotificationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => portalRepository.readNotification(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: portalDataQueryKey }),
  });
}

export function useReadAllNotificationsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => portalRepository.readAllNotifications(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: portalDataQueryKey }),
  });
}

export function useUnifiedSearchQuery(input: { q: string; limit?: number }) {
  const normalizedQuery = input.q.trim();
  return useQuery<UnifiedSearchResult>({
    queryKey: ["unified-search", normalizedQuery, input.limit ?? 25],
    queryFn: () => portalRepository.searchUnified({ q: normalizedQuery, limit: input.limit }),
    enabled: normalizedQuery.length >= 2,
  });
}

export function useKpiReportQuery(input?: { days?: number; officeId?: number }) {
  return useQuery<KpiReport>({
    queryKey: ["kpi-report", input?.days ?? 30, input?.officeId ?? "all"],
    queryFn: () => portalRepository.getKpiReport(input),
  });
}

export function useReportsDrilldownQuery(input?: {
  days?: number;
  officeId?: number;
  role?: "operator" | "office_head" | "director" | "admin";
}) {
  return useQuery<ReportsDrilldown>({
    queryKey: ["reports-drilldown", input?.days ?? 30, input?.officeId ?? "all", input?.role ?? "all"],
    queryFn: () => portalRepository.getReportsDrilldown(input),
  });
}

export function useReportSchedulesQuery(enabled = true) {
  return useQuery<ReportDeliverySchedule[]>({
    queryKey: ["report-schedules"],
    queryFn: () => portalRepository.getReportSchedules(),
    enabled,
  });
}

export function useReportRunsQuery(input?: { scheduleId?: number }, enabled = true) {
  return useQuery<ReportDeliveryRun[]>({
    queryKey: ["report-runs", input?.scheduleId ?? "all"],
    queryFn: () => portalRepository.getReportRuns(input),
    enabled,
  });
}

export function useCreateReportScheduleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name: string;
      recipientUserId: string;
      officeId?: number;
      roleFilter?: "operator" | "office_head" | "director" | "admin";
      daysWindow?: number;
      frequency?: "daily" | "weekly" | "monthly";
      nextRunAt?: string;
      isActive?: boolean;
    }) => portalRepository.createReportSchedule(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["report-schedules"] }),
  });
}

export function useUpdateReportScheduleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: number;
      patch: {
        name?: string;
        recipientUserId?: string;
        officeId?: number;
        roleFilter?: "operator" | "office_head" | "director" | "admin";
        daysWindow?: number;
        frequency?: "daily" | "weekly" | "monthly";
        nextRunAt?: string;
        isActive?: boolean;
      };
    }) => portalRepository.updateReportSchedule(input.id, input.patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["report-schedules"] }),
  });
}

export function useRunReportScheduleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => portalRepository.runReportSchedule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report-schedules"] });
      queryClient.invalidateQueries({ queryKey: ["report-runs"] });
      queryClient.invalidateQueries({ queryKey: portalDataQueryKey });
    },
  });
}
