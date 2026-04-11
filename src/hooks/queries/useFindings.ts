import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import type { FindingListItem } from "@/lib/api-types";
import { MutationCallbacks, invalidateQueryKeys, toError } from "./mutationUtils";
import { type FindingsSourceFilters, queryKeys } from "./queryKeys";

export interface FindingsQueryOptions {
  projectId?: string;
  scenario?: FindingListItem["scenario"];
  enabled?: boolean;
  refetchInterval?: number | false;
}

export interface TaskFindingsQueryOptions extends FindingsQueryOptions {
  taskId?: string;
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

const getFindingsPath = ({ projectId, scenario }: FindingsSourceFilters = {}) => {
  const params = new URLSearchParams();

  if (projectId) params.set("projectId", projectId);
  if (scenario) params.set("scenario", scenario);

  const queryString = params.toString();
  return queryString ? `/findings?${queryString}` : "/findings";
};

export const useFindingsQuery = ({
  projectId,
  scenario,
  enabled = true,
  refetchInterval,
}: FindingsQueryOptions = {}) =>
  useQuery({
    queryKey: queryKeys.findings.list({ projectId, scenario }),
    queryFn: () => apiRequest<FindingListItem[]>(getFindingsPath({ projectId, scenario })),
    enabled: enabled && (!projectId || Boolean(projectId)) && (!scenario || Boolean(scenario)),
    refetchInterval,
  });

export const useTaskFindingsQuery = ({
  taskId,
  projectId,
  scenario,
  enabled = true,
  refetchInterval,
}: TaskFindingsQueryOptions = {}) => {
  const query = useFindingsQuery({
    projectId,
    scenario,
    enabled,
    refetchInterval,
  });

  const allFindings = useMemo(() => query.data ?? [], [query.data]);
  const taskFindings = useMemo(
    () => (taskId ? allFindings.filter((finding) => finding.taskId === taskId) : allFindings),
    [allFindings, taskId],
  );

  return {
    ...query,
    allFindings,
    taskFindings,
    data: taskFindings,
  };
};

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
