import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import type { DashboardResponse } from "@/lib/api-types";
import { queryKeys } from "./queryKeys";

export const useDashboardQuery = () =>
  useQuery({
    queryKey: queryKeys.dashboard.all,
    queryFn: () => apiRequest<DashboardResponse>("/dashboard"),
  });
