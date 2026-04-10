import type { QueryClient } from "@tanstack/react-query";

export interface MutationCallbacks<TData, TVariables> {
  onSuccess?: (data: TData, variables: TVariables) => void | Promise<void>;
  onError?: (error: Error, variables: TVariables) => void | Promise<void>;
}

export const toError = (error: unknown) => {
  if (error instanceof Error) {
    return error;
  }

  return new Error("\u8bf7\u6c42\u5931\u8d25");
};

export const invalidateQueryKeys = async (
  queryClient: QueryClient,
  queryKeys: ReadonlyArray<readonly unknown[]>,
) => {
  await Promise.all(queryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
};
