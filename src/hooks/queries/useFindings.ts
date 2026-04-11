import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import type { FindingListItem } from "@/lib/api-types";
import { MutationCallbacks, invalidateQueryKeys, toError } from "./mutationUtils";
import { type FindingsSourceFilters, queryKeys } from "./queryKeys";

export interface FindingsQueryOptions {
  projectId?: string;
  scenario?: FindingListItem["scenario"];
  taskId?: string;
  enabled?: boolean;
  refetchInterval?: number | false;
}

export interface TaskFindingsQueryOptions {
  taskId?: string;
  enabled?: boolean;
  refetchInterval?: number | false;
}

export interface UpdateFindingStatusInput {
  id: string;
  status: FindingListItem["status"];
  note?: string;
  reviewer?: string;
}

export interface AddFindingReviewLogInput {
  id: string;
  note: string;
  reviewer: string;
}

const getFindingsPath = ({ projectId, scenario, taskId }: FindingsSourceFilters = {}) => {
  const params = new URLSearchParams();

  if (projectId) params.set("projectId", projectId);
  if (scenario) params.set("scenario", scenario);
  if (taskId) params.set("taskId", taskId);

  const queryString = params.toString();
  return queryString ? `/findings?${queryString}` : "/findings";
};

export const useFindingsQuery = ({
  projectId,
  scenario,
  taskId,
  enabled = true,
  refetchInterval,
}: FindingsQueryOptions = {}) =>
  useQuery({
    queryKey: queryKeys.findings.list({ projectId, scenario, taskId }),
    queryFn: () => apiRequest<FindingListItem[]>(getFindingsPath({ projectId, scenario, taskId })),
    enabled:
      enabled &&
      (!projectId || Boolean(projectId)) &&
      (!scenario || Boolean(scenario)) &&
      (!taskId || Boolean(taskId)),
    refetchInterval,
  });

export const useTaskFindingsQuery = ({
  taskId,
  enabled = true,
  refetchInterval,
}: TaskFindingsQueryOptions = {}) =>
  useFindingsQuery({
    taskId,
    enabled: enabled && Boolean(taskId),
    refetchInterval,
  });

export const useUpdateFindingStatusMutation = (
  callbacks: MutationCallbacks<FindingListItem, UpdateFindingStatusInput> = {},
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status, note, reviewer }: UpdateFindingStatusInput) =>
      apiRequest<FindingListItem>(`/findings/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          note,
          reviewer,
        }),
      }),
    onSuccess: async (data, variables) => {
      await invalidateQueryKeys(queryClient, [queryKeys.findings.all, queryKeys.projects.all]);
      await callbacks.onSuccess?.(data, variables);
    },
    onError: async (error, variables) => {
      await callbacks.onError?.(toError(error), variables);
    },
  });
};

export const useAddFindingReviewLogMutation = (
  callbacks: MutationCallbacks<FindingListItem, AddFindingReviewLogInput> = {},
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, note, reviewer }: AddFindingReviewLogInput) =>
      apiRequest<FindingListItem>(`/findings/${id}/review-log`, {
        method: "POST",
        body: JSON.stringify({
          note,
          reviewer,
        }),
      }),
    onSuccess: async (data, variables) => {
      await invalidateQueryKeys(queryClient, [queryKeys.findings.all]);
      await callbacks.onSuccess?.(data, variables);
    },
    onError: async (error, variables) => {
      await callbacks.onError?.(toError(error), variables);
    },
  });
};
