import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import type { DocumentItem, DocumentRole } from "@/lib/api-types";
import { MutationCallbacks, invalidateQueryKeys, toError } from "./mutationUtils";
import { queryKeys } from "./queryKeys";

export interface DocumentsQueryOptions {
  projectId?: string;
  enabled?: boolean;
}

export interface UploadDocumentInput {
  projectId: string;
  role: DocumentRole;
  file: File;
}

interface DeleteDocumentResult {
  success: boolean;
  documentId: string;
}

const getDocumentsPath = (projectId?: string) =>
  projectId ? `/documents?projectId=${encodeURIComponent(projectId)}` : "/documents";

export const useDocumentsQuery = ({ projectId, enabled = true }: DocumentsQueryOptions = {}) =>
  useQuery({
    queryKey: queryKeys.documents.list(projectId),
    queryFn: () => apiRequest<DocumentItem[]>(getDocumentsPath(projectId)),
    enabled: enabled && (!projectId || Boolean(projectId)),
  });

export const useUploadDocumentMutation = (
  callbacks: MutationCallbacks<DocumentItem, UploadDocumentInput> = {},
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, role, file }: UploadDocumentInput) => {
      if (!projectId) {
        throw new Error("\u8bf7\u5148\u9009\u62e9\u9879\u76ee");
      }

      const formData = new FormData();
      formData.append("projectId", projectId);
      formData.append("role", role);
      formData.append("file", file);

      return apiRequest<DocumentItem>("/documents/upload", {
        method: "POST",
        body: formData,
      });
    },
    onSuccess: async (data, variables) => {
      await invalidateQueryKeys(queryClient, [queryKeys.documents.all]);
      await callbacks.onSuccess?.(data, variables);
    },
    onError: async (error, variables) => {
      await callbacks.onError?.(toError(error), variables);
    },
  });
};

export const useDeleteDocumentMutation = (
  callbacks: MutationCallbacks<DeleteDocumentResult, string> = {},
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (documentId: string) =>
      apiRequest<DeleteDocumentResult>(`/documents/${documentId}`, {
        method: "DELETE",
      }),
    onSuccess: async (data, variables) => {
      await invalidateQueryKeys(queryClient, [
        queryKeys.documents.all,
        queryKeys.reviewTasks.all,
        queryKeys.findings.all,
        queryKeys.dashboard.all,
        queryKeys.projects.all,
      ]);
      await callbacks.onSuccess?.(data, variables);
    },
    onError: async (error, variables) => {
      await callbacks.onError?.(toError(error), variables);
    },
  });
};
