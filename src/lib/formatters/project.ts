import type { ProjectStatus } from "@/lib/api-types";

export const getProjectStatusClassName = (status: ProjectStatus) => {
  if (status === "\u8fdb\u884c\u4e2d") return "border-primary/20 bg-primary/10 text-primary";
  if (status === "\u5df2\u5b8c\u6210") return "border-success/20 bg-success/10 text-success";
  if (status === "\u672a\u5b8c\u6210") return "border-warning/20 bg-warning/10 text-warning";
  return "border-border bg-background/80 text-muted-foreground";
};
