import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import type { ProjectListItem, ProjectReviewType } from "@/lib/api-types";
import { MutationCallbacks, invalidateQueryKeys, toError } from "./mutationUtils";
import { queryKeys } from "./queryKeys";

export interface CreateProjectInput {
  name: string;
  type: ProjectReviewType;
  description: string;
}

interface DeleteProjectResult {
  success: boolean;
  projectId: string;
}

const getProjectsPath = (search = "") => {
  const keyword = search.trim();
  return `/projects?search=${encodeURIComponent(keyword)}`;
};

export const useProjectsQuery = (search = "") =>
  useQuery({
    queryKey: queryKeys.projects.list(search),
    queryFn: () => apiRequest<ProjectListItem[]>(getProjectsPath(search)),
  });

export const useCreateProjectMutation = (
  callbacks: MutationCallbacks<ProjectListItem, CreateProjectInput> = {},
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateProjectInput) =>
      apiRequest<ProjectListItem>("/projects", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: async (data, variables) => {
      await invalidateQueryKeys(queryClient, [queryKeys.projects.all]);
      await callbacks.onSuccess?.(data, variables);
    },
    onError: async (error, variables) => {
      await callbacks.onError?.(toError(error), variables);
    },
  });
};

export const useDeleteProjectMutation = (
  callbacks: MutationCallbacks<DeleteProjectResult, string> = {},
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) =>
      apiRequest<DeleteProjectResult>(`/projects/${projectId}`, {
        method: "DELETE",
      }),
    onSuccess: async (data, variables) => {
      await invalidateQueryKeys(queryClient, [queryKeys.projects.all, queryKeys.dashboard.all]);
      await callbacks.onSuccess?.(data, variables);
    },
    onError: async (error, variables) => {
      await callbacks.onError?.(toError(error), variables);
    },
  });
};
