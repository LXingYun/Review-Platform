import { describe, expect, it } from "vitest";
import type { Finding } from "../../shared/types";
import {
  buildConsistencyFingerprint,
  buildConsistencyRunHash,
  buildScenarioPromptVersion,
  deriveDeterministicSeed,
  diffConsistencyHash,
} from "../../server/services/review-consistency-service";

const createFinding = (overrides: Partial<Finding> = {}): Finding => ({
  id: overrides.id ?? "finding-1",
  projectId: overrides.projectId ?? "project-1",
  taskId: overrides.taskId ?? "task-1",
  title: overrides.title ?? "Qualification mismatch",
  category: overrides.category ?? "资格响应",
  risk: overrides.risk ?? "高",
  status: overrides.status ?? "待复核",
  location: overrides.location ?? "Section A",
  description: overrides.description ?? "Bid response does not cover the tender requirement.",
  recommendation: overrides.recommendation ?? "补充响应说明。",
  references: overrides.references ?? ["Tender section A"],
  sourceChunkIds: overrides.sourceChunkIds ?? ["source-1"],
  candidateChunkIds: overrides.candidateChunkIds ?? ["candidate-1"],
  regulationChunkIds: overrides.regulationChunkIds ?? [],
  needsHumanReview: overrides.needsHumanReview ?? true,
  confidence: overrides.confidence ?? 0.6,
  reviewStage: overrides.reviewStage ?? "response_consistency_review",
  scenario: overrides.scenario ?? "bid_consistency",
  reviewLogs: overrides.reviewLogs ?? [],
  createdAt: overrides.createdAt ?? "2026-04-16T00:00:00.000Z",
});

describe("review-consistency-service", () => {
  it("builds the same fingerprint for the same logical input", () => {
    const input = {
      scenario: "bid_consistency" as const,
      consistencyMode: "strict" as const,
      documents: [
        {
          role: "bid" as const,
          contentHash: "hash-bid",
          parseMethod: "plain-text" as const,
          extractedText: "response text",
        },
        {
          role: "tender" as const,
          contentHash: "hash-tender",
          parseMethod: "plain-text" as const,
          extractedText: "requirement text",
        },
      ],
      regulations: [],
      model: "deepseek-reasoner",
      promptVersion: buildScenarioPromptVersion("bid_consistency"),
    };

    const first = buildConsistencyFingerprint(input);
    const second = buildConsistencyFingerprint({
      ...input,
      documents: input.documents.slice().reverse(),
    });

    expect(first).toBe(second);
    expect(deriveDeterministicSeed(first)).toBe(deriveDeterministicSeed(second));
  });

  it("builds the same run hash when only runtime fields change", () => {
    const first = buildConsistencyRunHash([
      createFinding(),
      createFinding({
        id: "finding-2",
        title: "Commercial deviation",
        category: "商务响应",
        risk: "中",
        location: "Section B",
      }),
    ]);

    const second = buildConsistencyRunHash([
      createFinding({
        id: "finding-9",
        taskId: "task-9",
        projectId: "project-9",
        createdAt: "2026-04-16T00:10:00.000Z",
      }),
      createFinding({
        id: "finding-8",
        taskId: "task-8",
        projectId: "project-8",
        title: "Commercial deviation",
        category: "商务响应",
        risk: "中",
        location: "Section B",
        createdAt: "2026-04-16T00:20:00.000Z",
      }),
    ]);

    expect(first).toBe(second);
  });

  it("summarizes added, removed, and changed risk deltas", () => {
    const previous = [
      createFinding(),
      createFinding({
        id: "finding-2",
        title: "Commercial deviation",
        category: "商务响应",
        risk: "中",
        location: "Section B",
      }),
    ];
    const next = [
      createFinding({
        id: "finding-3",
        risk: "中",
      }),
      createFinding({
        id: "finding-4",
        title: "Attachment missing",
        category: "附件材料",
        risk: "低",
        location: "Section C",
      }),
    ];

    expect(diffConsistencyHash(previous, next)).toEqual({
      added: 1,
      removed: 1,
      changedRisk: 1,
    });
  });
});
