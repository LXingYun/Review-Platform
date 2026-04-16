import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Outlet, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import AppLayout from "@/components/AppLayout";
import { AuthProvider } from "@/context/AuthProvider";
import { RequireAdmin } from "@/routes/RequireAdmin";
import { RequireAuth } from "@/routes/RequireAuth";
import Index from "./pages/Index";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import TaskDetail from "./pages/TaskDetail";
import Upload from "./pages/Upload";
import Regulations from "./pages/Regulations";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import AdminUsers from "./pages/AdminUsers";

const queryClient = new QueryClient();

const ProtectedLayout = () => (
  <RequireAuth>
    <AppLayout>
      <Outlet />
    </AppLayout>
  </RequireAuth>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route element={<ProtectedLayout />}>
                <Route path="/" element={<Index />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/projects/:projectId" element={<ProjectDetail />} />
                <Route path="/tasks/:taskId" element={<TaskDetail />} />
                <Route path="/upload" element={<Upload />} />
                <Route path="/regulations" element={<Regulations />} />
                <Route
                  path="/admin/users"
                  element={
                    <RequireAdmin>
                      <AdminUsers />
                    </RequireAdmin>
                  }
                />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
