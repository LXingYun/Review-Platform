import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import type { ReviewTaskDetailItem, ReviewTaskResult } from "@/lib/api-types";
import { MutationCallbacks, invalidateQueryKeys, toError } from "./mutationUtils";
import { queryKeys } from "./queryKeys";

export interface ReviewTasksQueryOptions {
  projectId?: string;
  enabled?: boolean;
  refetchInterval?: number | false;
}

export interface ReviewTaskQueryOptions {
  enabled?: boolean;
  refetchInterval?: number | false;
}

export interface CreateTenderReviewInput {
  projectId: string;
  tenderDocumentId: string;
  regulationIds?: string[];
}

export interface CreateBidReviewInput {
  projectId: string;
  tenderDocumentId: string;
  bidDocumentId: string;
}

interface DeleteReviewTaskResult {
  success: boolean;
  taskId: string;
  projectId: string;
}

interface AbortReviewTaskResult {
  success: boolean;
}

const getReviewTasksPath = (projectId?: string) =>
  projectId ? `/review-tasks?projectId=${encodeURIComponent(projectId)}` : "/review-tasks";

const invalidateReviewTaskDependencies = (queryClient: ReturnType<typeof useQueryClient>) =>
  invalidateQueryKeys(queryClient, [
    queryKeys.reviewTasks.all,
    queryKeys.findings.all,
    queryKeys.projects.all,
    queryKeys.dashboard.all,
  ]);

export const useReviewTasksQuery = ({
  projectId,
  enabled = true,
  refetchInterval,
}: ReviewTasksQueryOptions = {}) =>
  useQuery({
    queryKey: queryKeys.reviewTasks.list(projectId),
    queryFn: () => apiRequest<ReviewTaskDetailItem[]>(getReviewTasksPath(projectId)),
    enabled: enabled && (!projectId || Boolean(projectId)),
    refetchInterval,
  });

export const useReviewTaskQuery = (
  taskId?: string,
  { enabled = true, refetchInterval }: ReviewTaskQueryOptions = {},
) =>
  useQuery({
    queryKey: queryKeys.reviewTasks.detail(taskId),
    queryFn: () => apiRequest<ReviewTaskDetailItem>(`/review-tasks/${taskId}`),
    enabled: enabled && Boolean(taskId),
    refetchInterval: (query) => {
      if (refetchInterval !== undefined) {
        return refetchInterval;
      }

      const task = query.state.data;
      return task && (task.status === "待审核" || task.status === "进行中") ? 3000 : false;
    },
  });

export const useCreateTenderReviewMutation = (
  callbacks: MutationCallbacks<ReviewTaskResult, CreateTenderReviewInput> = {},
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, tenderDocumentId, regulationIds = [] }: CreateTenderReviewInput) =>
      apiRequest<ReviewTaskResult>("/reviews/tender-compliance", {
        method: "POST",
        body: JSON.stringify({
          projectId,
          tenderDocumentId,
          regulationIds,
        }),
      }),
    onSuccess: async (data, variables) => {
      await invalidateReviewTaskDependencies(queryClient);
      await callbacks.onSuccess?.(data, variables);
    },
    onError: async (error, variables) => {
      await callbacks.onError?.(toError(error), variables);
    },
  });
};

export const useCreateBidReviewMutation = (
  callbacks: MutationCallbacks<ReviewTaskResult, CreateBidReviewInput> = {},
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateBidReviewInput) =>
      apiRequest<ReviewTaskResult>("/reviews/bid-consistency", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: async (data, variables) => {
      await invalidateReviewTaskDependencies(queryClient);
      await callbacks.onSuccess?.(data, variables);
    },
    onError: async (error, variables) => {
      await callbacks.onError?.(toError(error), variables);
    },
  });
};

export const useRetryReviewTaskMutation = (
  callbacks: MutationCallbacks<ReviewTaskResult, string> = {},
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) =>
      apiRequest<ReviewTaskResult>(`/review-tasks/${taskId}/retry`, {
        method: "POST",
      }),
    onSuccess: async (data, variables) => {
      await invalidateReviewTaskDependencies(queryClient);
      await callbacks.onSuccess?.(data, variables);
    },
    onError: async (error, variables) => {
      await callbacks.onError?.(toError(error), variables);
    },
  });
};

export const useAbortReviewTaskMutation = (
  callbacks: MutationCallbacks<AbortReviewTaskResult, string> = {},
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) =>
      apiRequest<AbortReviewTaskResult>(`/review-tasks/${taskId}/abort`, {
        method: "POST",
      }),
    onSuccess: async (data, variables) => {
      await invalidateReviewTaskDependencies(queryClient);
      await callbacks.onSuccess?.(data, variables);
    },
    onError: async (error, variables) => {
      await callbacks.onError?.(toError(error), variables);
    },
  });
};

export const useDeleteReviewTaskMutation = (
  callbacks: MutationCallbacks<DeleteReviewTaskResult, string> = {},
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) =>
      apiRequest<DeleteReviewTaskResult>(`/review-tasks/${taskId}`, {
        method: "DELETE",
      }),
    onSuccess: async (data, variables) => {
      await invalidateReviewTaskDependencies(queryClient);
      await callbacks.onSuccess?.(data, variables);
    },
    onError: async (error, variables) => {
      await callbacks.onError?.(toError(error), variables);
    },
  });
};
