import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ProjectReviewType } from "@/lib/api-types";

interface CreateProjectDialogProps {
  open: boolean;
  name: string;
  type: ProjectReviewType | "";
  description: string;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onNameChange: (value: string) => void;
  onTypeChange: (value: ProjectReviewType) => void;
  onDescriptionChange: (value: string) => void;
  onCreateProject: () => void;
}

const CreateProjectDialog = ({
  open,
  name,
  type,
  description,
  isPending,
  onOpenChange,
  onNameChange,
  onTypeChange,
  onDescriptionChange,
  onCreateProject,
}: CreateProjectDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogTrigger asChild>
      <Button size="lg" className="rounded-full px-6">
        <Plus className="mr-2 h-4 w-4" />
        新建项目
      </Button>
    </DialogTrigger>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>新建审查项目</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 pt-2">
        <div>
          <Label>项目名称</Label>
          <Input placeholder="输入项目名称" className="mt-1" value={name} onChange={(e) => onNameChange(e.target.value)} />
        </div>
        <div>
          <Label>审查类型</Label>
          <Select value={type} onValueChange={(value) => onTypeChange(value as ProjectReviewType)}>
            <SelectTrigger className="mt-1 rounded-[18px]">
              <SelectValue placeholder="选择类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="招标审查">招标审查</SelectItem>
              <SelectItem value="投标审查">投标审查</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>项目描述</Label>
          <Textarea
            placeholder="输入项目描述"
            className="mt-1"
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
          />
        </div>
        <Button className="w-full" disabled={!name || !type || isPending} onClick={onCreateProject}>
          {isPending ? "创建中..." : "创建项目"}
        </Button>
      </div>
    </DialogContent>
  </Dialog>
);

export default CreateProjectDialog;
