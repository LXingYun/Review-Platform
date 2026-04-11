import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface CreateRegulationDialogProps {
  open: boolean;
  name: string;
  category: string;
  updated: string;
  textPreview: string;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onNameChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onUpdatedChange: (value: string) => void;
  onTextPreviewChange: (value: string) => void;
  onCreate: () => void;
}

const CreateRegulationDialog = ({
  open,
  name,
  category,
  updated,
  textPreview,
  isPending,
  onOpenChange,
  onNameChange,
  onCategoryChange,
  onUpdatedChange,
  onTextPreviewChange,
  onCreate,
}: CreateRegulationDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogTrigger asChild>
      <Button>
        <Plus className="mr-2 h-4 w-4" />
        添加法规
      </Button>
    </DialogTrigger>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>添加法规</DialogTitle>
        <DialogDescription>先支持手动录入基础法规摘要，后续可替换为正式导入。</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div>
          <Label>法规名称</Label>
          <Input value={name} onChange={(e) => onNameChange(e.target.value)} placeholder="输入法规名称" className="mt-1" />
        </div>
        <div>
          <Label>法规分类</Label>
          <Input
            value={category}
            onChange={(e) => onCategoryChange(e.target.value)}
            placeholder="如：法律 / 行政法规 / 部门规章"
            className="mt-1"
          />
        </div>
        <div>
          <Label>更新时间</Label>
          <Input value={updated} onChange={(e) => onUpdatedChange(e.target.value)} placeholder="如：2024-01-01 或 手动录入" className="mt-1" />
        </div>
        <div>
          <Label>条款摘要</Label>
          <Textarea
            value={textPreview}
            onChange={(e) => onTextPreviewChange(e.target.value)}
            placeholder="输入可用于审查的基础条款摘要"
            className="mt-1"
          />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={onCreate} disabled={!name || !textPreview || isPending}>
          {isPending ? "保存中..." : "保存法规"}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default CreateRegulationDialog;
