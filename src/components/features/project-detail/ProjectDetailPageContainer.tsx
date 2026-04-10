import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  useAbortReviewTaskMutation,
  useDeleteProjectMutation,
  useDeleteReviewTaskMutation,
  useDocumentsQuery,
  useProjectsQuery,
  useRetryReviewTaskMutation,
  useReviewTasksQuery,
} from "@/hooks/queries";
import ProjectDetailHero from "./ProjectDetailHero";
import ProjectDocumentsCard from "./ProjectDocumentsCard";
import ProjectTasksCard from "./ProjectTasksCard";

const ProjectDetailPageContainer = () => {
  const navigate = useNavigate();
  const { projectId = "" } = useParams();

  const { data: projects = [], isLoading: projectsLoading } = useProjectsQuery();
  const { data: tasks = [], isLoading: tasksLoading } = useReviewTasksQuery({
    projectId,
    enabled: Boolean(projectId),
  });
  const { data: documents = [], isLoading: documentsLoading } = useDocumentsQuery({
    projectId,
    enabled: Boolean(projectId),
  });

  const project = useMemo(() => projects.find((item) => item.id === projectId), [projects, projectId]);

  const deleteProjectMutation = useDeleteProjectMutation({
    onSuccess: () => {
      navigate("/projects");
    },
  });

  const deleteTaskMutation = useDeleteReviewTaskMutation();
  const retryTaskMutation = useRetryReviewTaskMutation();
  const abortTaskMutation = useAbortReviewTaskMutation();

  if (projectsLoading) {
    return <p className="text-sm text-muted-foreground">项目详情加载中...</p>;
  }

  if (!project) {
    return <p className="text-sm text-destructive">未找到该项目。</p>;
  }

  return (
    <div className="space-y-8 pb-8">
      <ProjectDetailHero
        project={project}
        documentsCount={documents.length}
        isDeletingProject={deleteProjectMutation.isPending}
        onDeleteProject={() => deleteProjectMutation.mutate(projectId)}
        onCreateTask={() => navigate(`/upload?projectId=${encodeURIComponent(project.id)}`)}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <ProjectTasksCard
          tasksLoading={tasksLoading}
          tasks={tasks}
          abortPending={abortTaskMutation.isPending}
          retryPending={retryTaskMutation.isPending}
          deletePending={deleteTaskMutation.isPending}
          onAbortTask={(taskId) => abortTaskMutation.mutate(taskId)}
          onRetryTask={(taskId) => retryTaskMutation.mutate(taskId)}
          onDeleteTask={(taskId) => deleteTaskMutation.mutate(taskId)}
          onOpenTask={(taskId) => navigate(`/tasks/${taskId}`)}
        />
        <ProjectDocumentsCard documentsLoading={documentsLoading} documents={documents} />
      </div>
    </div>
  );
};

export default ProjectDetailPageContainer;
