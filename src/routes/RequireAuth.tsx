import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthProvider";

export const RequireAuth = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return <div className="p-8 text-sm text-muted-foreground">加载中...</div>;
  }

  if (!isAuthenticated) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }

  return <>{children}</>;
};
