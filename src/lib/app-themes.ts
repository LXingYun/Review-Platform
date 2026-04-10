export type AppTheme = "editorial" | "professional";

export const appThemes: Array<{ value: AppTheme; label: string; shortLabel: string; description: string }> = [
  {
    value: "editorial",
    label: "编辑风格",
    shortLabel: "编",
    description: "偏温和的内容工作台，强调层次、留白和阅读感。",
  },
  {
    value: "professional",
    label: "专业风格",
    shortLabel: "专",
    description: "蓝白专业风格，适合项目、法规和审查流程类界面。",
  },
];
