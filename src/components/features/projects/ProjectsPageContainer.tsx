import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { ProjectReviewType } from "@/lib/api-types";
import { useCreateProjectMutation, useDeleteProjectMutation, useProjectsQuery } from "@/hooks/queries";
import CreateProjectDialog from "./CreateProjectDialog";
import ProjectCard from "./ProjectCard";

const ProjectsPageContainer = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<ProjectReviewType | "">("");
  const [description, setDescription] = useState("");

  const { data: projects = [], isLoading, isError } = useProjectsQuery(search);

  const createProjectMutation = useCreateProjectMutation({
    onSuccess: () => {
      setOpen(false);
      setName("");
      setType("");
      setDescription("");
    },
  });

  const deleteProjectMutation = useDeleteProjectMutation();

  const handleCreateProject = () => {
    if (!type) return;
    createProjectMutation.mutate({ name, type, description });
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="搜索项目..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-11" />
        </div>

        <CreateProjectDialog
          open={open}
          name={name}
          type={type}
          description={description}
          isPending={createProjectMutation.isPending}
          onOpenChange={setOpen}
          onNameChange={setName}
          onTypeChange={setType}
          onDescriptionChange={setDescription}
          onCreateProject={handleCreateProject}
        />
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">项目加载中...</p>}
      {isError && <p className="text-sm text-destructive">项目数据加载失败</p>}

      {!isLoading && !isError && projects.length === 0 && (
        <p className="py-8 text-sm text-muted-foreground">还没有项目，点击右上角“新建项目”开始。</p>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            isDeleting={deleteProjectMutation.isPending}
            onOpenProject={(projectId) => navigate(`/projects/${projectId}`)}
            onDeleteProject={(projectId) => deleteProjectMutation.mutate(projectId)}
          />
        ))}
      </div>
    </div>
  );
};

export default ProjectsPageContainer;
