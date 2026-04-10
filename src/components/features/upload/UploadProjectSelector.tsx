import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ProjectListItem } from "@/lib/api-types";

interface UploadProjectSelectorProps {
  projects: ProjectListItem[];
  selectedProjectId: string;
  onProjectChange: (projectId: string) => void;
}

const UploadProjectSelector = ({
  projects,
  selectedProjectId,
  onProjectChange,
}: UploadProjectSelectorProps) => (
  <Card className="surface-panel bg-card/85">
    <CardHeader className="pb-3">
      <CardTitle className="text-base">选择项目</CardTitle>
      <CardDescription>系统会根据项目类型自动切换到对应的审查流程。</CardDescription>
    </CardHeader>
    <CardContent className="space-y-2">
      <Label>当前审查任务所属项目</Label>
      <Select value={selectedProjectId} onValueChange={onProjectChange}>
        <SelectTrigger>
          <SelectValue placeholder="请选择一个项目" />
        </SelectTrigger>
        <SelectContent>
          {projects.map((project) => (
            <SelectItem key={project.id} value={project.id}>
              {project.name} · {project.type}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </CardContent>
  </Card>
);

export default UploadProjectSelector;
