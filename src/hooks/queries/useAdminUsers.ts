import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AdminUsersResponse, AuthUserInfo } from "@/lib/api-types";
import { apiRequest } from "@/lib/api";
import { MutationCallbacks, invalidateQueryKeys, toError } from "./mutationUtils";
import { queryKeys } from "./queryKeys";

export interface CreateAdminUserInput {
  username: string;
  password: string;
  role: "admin" | "user";
}

export interface UpdateAdminUserInput {
  userId: string;
  role?: "admin" | "user";
  isActive?: boolean;
}

export interface ResetAdminUserPasswordInput {
  userId: string;
  password: string;
}

export const useAdminUsersQuery = () =>
  useQuery({
    queryKey: queryKeys.adminUsers.list(),
    queryFn: async () => {
      const payload = await apiRequest<AdminUsersResponse>("/admin/users");
      return payload.users;
    },
  });

export const useCreateAdminUserMutation = (
  callbacks: MutationCallbacks<AuthUserInfo, CreateAdminUserInput> = {},
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateAdminUserInput) => {
      const result = await apiRequest<{ user: AuthUserInfo }>("/admin/users", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      return result.user;
    },
    onSuccess: async (data, variables) => {
      await invalidateQueryKeys(queryClient, [queryKeys.adminUsers.all]);
      await callbacks.onSuccess?.(data, variables);
    },
    onError: async (error, variables) => {
      await callbacks.onError?.(toError(error), variables);
    },
  });
};

export const useUpdateAdminUserMutation = (
  callbacks: MutationCallbacks<AuthUserInfo, UpdateAdminUserInput> = {},
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, ...payload }: UpdateAdminUserInput) => {
      const result = await apiRequest<{ user: AuthUserInfo }>(`/admin/users/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      return result.user;
    },
    onSuccess: async (data, variables) => {
      await invalidateQueryKeys(queryClient, [queryKeys.adminUsers.all]);
      await callbacks.onSuccess?.(data, variables);
    },
    onError: async (error, variables) => {
      await callbacks.onError?.(toError(error), variables);
    },
  });
};

export const useResetAdminUserPasswordMutation = (
  callbacks: MutationCallbacks<void, ResetAdminUserPasswordInput> = {},
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, password }: ResetAdminUserPasswordInput) => {
      await apiRequest<void>(`/admin/users/${encodeURIComponent(userId)}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ password }),
      });
    },
    onSuccess: async (_data, variables) => {
      await invalidateQueryKeys(queryClient, [queryKeys.adminUsers.all]);
      await callbacks.onSuccess?.(undefined, variables);
    },
    onError: async (error, variables) => {
      await callbacks.onError?.(toError(error), variables);
    },
  });
};
