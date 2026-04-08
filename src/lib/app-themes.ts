export type AppTheme = "editorial" | "professional" | "midnight";

export const appThemes: Array<{ value: AppTheme; label: string; shortLabel: string; description: string }> = [
  {
    value: "editorial",
    label: "Editorial",
    shortLabel: "暖",
    description: "暖中性、衬线标题、Claude 风格",
  },
  {
    value: "professional",
    label: "Professional",
    shortLabel: "蓝",
    description: "蓝白专业、信息清晰、偏政企审查感",
  },
  {
    value: "midnight",
    label: "Midnight",
    shortLabel: "夜",
    description: "深夜工作台、对比更强、低光环境友好",
  },
];
