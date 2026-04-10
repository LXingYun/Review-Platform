import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import type { FindingListItem } from "@/lib/api-types";
import { MutationCallbacks, invalidateQueryKeys, toError } from "./mutationUtils";
import { type FindingsQueryFilters, queryKeys } from "./queryKeys";

export interface FindingsQueryOptions {
  filters?: FindingsQueryFilters;
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

const getFindingsPath = (filters: FindingsQueryFilters = {}) => {
  const params = new URLSearchParams();
  const search = filters.search?.trim();

  if (search) params.set("search", search);
  if (filters.status) params.set("status", filters.status);
  if (filters.projectId) params.set("projectId", filters.projectId);
  if (filters.scenario) params.set("scenario", filters.scenario);

  const queryString = params.toString();
  return queryString ? `/findings?${queryString}` : "/findings";
};

export const useFindingsQuery = ({
  filters = {},
  enabled = true,
  refetchInterval,
}: FindingsQueryOptions = {}) =>
  useQuery({
    queryKey: queryKeys.findings.list(filters),
    queryFn: async () => {
      const findings = await apiRequest<FindingListItem[]>(getFindingsPath(filters));

      if (filters.taskId) {
        return findings.filter((finding) => finding.taskId === filters.taskId);
      }

      return findings;
    },
    enabled,
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
