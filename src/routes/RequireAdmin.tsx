import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/useAuth";

export const RequireAdmin = ({ children }: { children: React.ReactNode }) => {
  const { isLoading, user } = useAuth();

  if (isLoading) {
    return <div className="p-8 text-sm text-muted-foreground">加载中...</div>;
  }

  if (!user || user.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
