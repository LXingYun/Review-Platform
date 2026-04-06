import { useState } from "react";
import { Plus, Search, MoreVertical, FolderKanban } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Project {
  id: number;
  name: string;
  type: string;
  status: string;
  taskCount: number;
  issueCount: number;
  date: string;
}

const initialProjects: Project[] = [
  { id: 1, name: "XX市政工程", type: "招标审查", status: "进行中", taskCount: 5, issueCount: 12, date: "2026-04-01" },
  { id: 2, name: "医疗设备采购", type: "投标审查", status: "已完成", taskCount: 3, issueCount: 4, date: "2026-03-28" },
  { id: 3, name: "智慧城市项目", type: "招标审查", status: "待开始", taskCount: 0, issueCount: 0, date: "2026-04-05" },
  { id: 4, name: "高速公路建设", type: "投标审查", status: "进行中", taskCount: 8, issueCount: 23, date: "2026-03-20" },
  { id: 5, name: "学校建设工程", type: "招标审查", status: "已完成", taskCount: 4, issueCount: 7, date: "2026-03-15" },
  { id: 6, name: "水利工程建设", type: "投标审查", status: "待开始", taskCount: 0, issueCount: 0, date: "2026-04-06" },
];

const statusStyle = (status: string) => {
  if (status === "进行中") return "bg-primary/10 text-primary border-primary/20";
  if (status === "已完成") return "bg-success/10 text-success border-success/20";
  return "bg-muted text-muted-foreground border-border";
};

const Projects = () => {
  const [search, setSearch] = useState("");
  const [projects] = useState<Project[]>(initialProjects);

  const filtered = projects.filter((p) => p.name.includes(search) || p.type.includes(search));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">项目管理</h1>
          <p className="text-muted-foreground mt-1">管理所有审查项目与任务</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
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
                <Input placeholder="输入项目名称" className="mt-1" />
              </div>
              <div>
                <Label>审查类型</Label>
                <Select>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="选择类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bid">招标审查</SelectItem>
                    <SelectItem value="tender">投标审查</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>项目描述</Label>
                <Textarea placeholder="输入项目描述" className="mt-1" />
              </div>
              <Button className="w-full">创建项目</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="搜索项目..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((project) => (
          <Card key={project.id} className="border border-border shadow-sm hover:shadow-md transition-shadow cursor-pointer group">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <FolderKanban className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{project.name}</h3>
                    <p className="text-xs text-muted-foreground">{project.type}</p>
                  </div>
                </div>
                <button className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground">
                  <MoreVertical className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center gap-3 mt-4">
                <Badge variant="outline" className={statusStyle(project.status)}>
                  {project.status}
                </Badge>
                <span className="text-xs text-muted-foreground">{project.date}</span>
              </div>
              <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                <span>任务: {project.taskCount}</span>
                <span>问题: {project.issueCount}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Projects;
