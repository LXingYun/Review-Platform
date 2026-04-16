import { z } from "zod";

const consistencyModeSchema = z.enum(["balanced", "strict"]).default("balanced");

export const createProjectSchema = z.object({
  name: z.string().min(1, "项目名称不能为空"),
  type: z.enum(["招标审查", "投标审查"]),
  description: z.string().default(""),
});

export const uploadDocumentSchema = z.object({
  projectId: z.string().min(1, "缺少项目 ID"),
  role: z.enum(["tender", "bid", "regulation", "clarification", "attachment"]),
});

export const createTenderReviewSchema = z.object({
  projectId: z.string().min(1),
  tenderDocumentId: z.string().min(1),
  regulationIds: z.array(z.string()).default([]),
  consistencyMode: consistencyModeSchema.optional(),
});

export const createBidReviewSchema = z.object({
  projectId: z.string().min(1),
  tenderDocumentId: z.string().min(1),
  bidDocumentId: z.string().min(1),
  consistencyMode: consistencyModeSchema.optional(),
});

export const updateFindingStatusSchema = z.object({
  status: z.enum(["待复核", "已确认", "已忽略"]),
  note: z.string().trim().max(2000).optional(),
  reviewer: z.string().trim().max(100).optional(),
});

export const createFindingReviewLogSchema = z.object({
  note: z.string().trim().min(1).max(2000),
  reviewer: z.string().trim().min(1).max(100),
});

export const createRegulationSchema = z.object({
  name: z.string().min(1, "法规名称不能为空"),
  category: z.string().min(1, "法规分类不能为空"),
  updated: z.string().min(1, "更新时间不能为空"),
  ruleCount: z.coerce.number().int().positive(),
  textPreview: z.string().default(""),
  chunks: z
    .array(
      z.object({
        id: z.string(),
        text: z.string(),
        order: z.coerce.number().int().positive(),
        sectionTitle: z.string().optional(),
      }),
    )
    .default([]),
  sections: z.array(
    z.object({
      title: z.string().min(1),
      rules: z.coerce.number().int().nonnegative(),
    }),
  ),
});
