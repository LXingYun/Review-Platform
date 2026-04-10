import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import type { RegulationDraft, RegulationItem } from "@/lib/api-types";
import { MutationCallbacks, invalidateQueryKeys, toError } from "./mutationUtils";
import { queryKeys } from "./queryKeys";

export interface CreateRegulationInput extends Omit<RegulationItem, "id"> {}

export interface SaveRegulationDraftInput {
  draft: RegulationDraft;
  regulationId?: string | null;
}

interface DeleteRegulationResult {
  success: boolean;
  regulationId: string;
}

const getRegulationsPath = (search = "") => `/regulations?search=${encodeURIComponent(search.trim())}`;

export const useRegulationsQuery = (search = "") =>
  useQuery({
    queryKey: queryKeys.regulations.list(search),
    queryFn: () => apiRequest<RegulationItem[]>(getRegulationsPath(search)),
  });

export const useCreateRegulationMutation = (
  callbacks: MutationCallbacks<RegulationItem, CreateRegulationInput> = {},
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateRegulationInput) =>
      apiRequest<RegulationItem>("/regulations", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: async (data, variables) => {
      await invalidateQueryKeys(queryClient, [queryKeys.regulations.all]);
      await callbacks.onSuccess?.(data, variables);
    },
    onError: async (error, variables) => {
      await callbacks.onError?.(toError(error), variables);
    },
  });
};

export const useDeleteRegulationMutation = (
  callbacks: MutationCallbacks<DeleteRegulationResult, string> = {},
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (regulationId: string) =>
      apiRequest<DeleteRegulationResult>(`/regulations/${regulationId}`, {
        method: "DELETE",
      }),
    onSuccess: async (data, variables) => {
      await invalidateQueryKeys(queryClient, [queryKeys.regulations.all]);
      await callbacks.onSuccess?.(data, variables);
    },
    onError: async (error, variables) => {
      await callbacks.onError?.(toError(error), variables);
    },
  });
};

export const usePreviewRegulationUploadMutation = (
  callbacks: MutationCallbacks<RegulationDraft, File> = {},
) => {
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      return apiRequest<RegulationDraft>("/regulations/upload/preview", {
        method: "POST",
        body: formData,
      });
    },
    onSuccess: async (data, variables) => {
      await callbacks.onSuccess?.(data, variables);
    },
    onError: async (error, variables) => {
      await callbacks.onError?.(toError(error), variables);
    },
  });
};

export const useSaveRegulationDraftMutation = (
  callbacks: MutationCallbacks<RegulationItem, SaveRegulationDraftInput> = {},
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ draft, regulationId }: SaveRegulationDraftInput) =>
      apiRequest<RegulationItem>(regulationId ? `/regulations/${regulationId}` : "/regulations", {
        method: regulationId ? "PUT" : "POST",
        body: JSON.stringify({
          ...draft,
          chunks: draft.chunks.map(({ sectionId, ...chunk }) => ({
            ...chunk,
            sectionTitle: sectionId,
          })),
        }),
      }),
    onSuccess: async (data, variables) => {
      await invalidateQueryKeys(queryClient, [queryKeys.regulations.all]);
      await callbacks.onSuccess?.(data, variables);
    },
    onError: async (error, variables) => {
      await callbacks.onError?.(toError(error), variables);
    },
  });
};
