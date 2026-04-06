import { z } from "zod";
import { requestStructuredAiReview } from "./ai-client-service";

const finalReportSchema = z.object({
  title: z.string(),
  executiveSummary: z.string(),
  fileOverview: z.string().default(""),
  complianceIssues: z.array(z.string()).default([]),
  integrityIssues: z.array(z.string()).default([]),
  reasonablenessIssues: z.array(z.string()).default([]),
  crossSectionIssues: z.array(z.string()).default([]),
  riskWarnings: z.array(z.string()).default([]),
  keyRisks: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),
  conclusion: z.string(),
});

export const generateFinalReviewReport = async (params: {
  projectLabel: string;
  scenarioLabel: string;
  findings: Array<{
    title: string;
    category: string;
    risk: string;
    description: string;
    recommendation: string;
    location: string;
    reviewStage: string;
  }>;
}) => {
  if (params.findings.length === 0) {
    return {
      title: "审查报告",
      executiveSummary: "当前筛选条件下未发现需要纳入正式报告的问题。",
      fileOverview: "",
      complianceIssues: [],
      integrityIssues: [],
      reasonablenessIssues: [],
      crossSectionIssues: [],
      riskWarnings: [],
      keyRisks: [],
      recommendations: [],
      conclusion: "建议结合原始文件继续人工复核。",
    };
  }

  return finalReportSchema.parse(
    await requestStructuredAiReview<unknown>({
      systemPrompt: [
        "你是建设工程与政府采购领域的资深招投标审查顾问，负责基于已经形成的结构化审查结果，撰写一份正式、专业、克制的《招标文件智能审查报告》。",
        "你的任务不是重新发现问题，而是归纳已有 findings、按风险和重要性排序，并形成适合政企客户阅读的正式报告。",
        "你的核心原则是：不得新增未在输入 findings 中出现的问题；不得把需人工复核的问题写成确定违规；不得编造法律依据、页码、条款编号或外部事实；语言必须专业、客观、克制。",
        "报告结构要求：文件概述、执行摘要、合规性问题、完整性问题、合理性与履约风险问题、跨章节冲突、风险提示、审查结论、修改建议。",
        "审查结论应在建议发布、修正后发布、存在严重缺陷不建议发布之间选择；如果输入 findings 不足以支撑强结论，应优先选择更审慎的表述。",
        "只返回合法 JSON。",
      ].join("\n"),
      userPrompt: JSON.stringify(
        {
          projectLabel: params.projectLabel,
          scenarioLabel: params.scenarioLabel,
          findings: params.findings,
          outputContract: {
            title: "string",
            executiveSummary: "string",
            fileOverview: "string",
            complianceIssues: ["string"],
            integrityIssues: ["string"],
            reasonablenessIssues: ["string"],
            crossSectionIssues: ["string"],
            riskWarnings: ["string"],
            keyRisks: ["string"],
            conclusion: "建议发布|修正后发布|存在严重缺陷不建议发布",
            recommendations: ["string"],
          },
        },
        null,
        2,
      ),
    }),
  );
};
