import { createHash } from "node:crypto";
import type {
  DocumentRecord,
  Finding,
  Regulation,
  ReviewConsistencyDiffSummary,
  ReviewConsistencyMode,
  ReviewScenario,
} from "../types";
import { toDeterministicSeed } from "./review-seed-service";

export const reviewPromptVersions = {
  bidConsistency: "bid-consistency-v1",
  tenderChapter: "tender-chapter-v1",
  tenderCrossSection: "tender-cross-section-v1",
} as const;

const hashString = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

const stableSort = <T>(values: T[], selector: (value: T) => string) =>
  values.slice().sort((left, right) => selector(left).localeCompare(selector(right)));

const hashDocumentInput = (document: Pick<DocumentRecord, "role" | "contentHash" | "parseMethod" | "extractedText">) =>
  hashString(
    JSON.stringify({
      role: document.role,
      contentHash: document.contentHash ?? null,
      parseMethod: document.parseMethod,
      extractedText: document.extractedText,
    }),
  );

const hashRegulationSnapshot = (regulation: Pick<Regulation, "id" | "name" | "category" | "updated" | "ruleCount" | "chunks">) =>
  hashString(
    JSON.stringify({
      name: regulation.name,
      category: regulation.category,
      updated: regulation.updated,
      ruleCount: regulation.ruleCount,
      chunks: regulation.chunks.map((chunk) => ({
        order: chunk.order,
        sectionTitle: chunk.sectionTitle ?? "",
        text: chunk.text,
      })),
    }),
  );

const buildComparableFindingKey = (finding: Finding) =>
  JSON.stringify({
    scenario: finding.scenario,
    reviewStage: finding.reviewStage,
    category: finding.category,
    title: finding.title,
    location: finding.location,
    description: finding.description,
    recommendation: finding.recommendation,
    references: finding.references,
    needsHumanReview: finding.needsHumanReview,
  });

const buildHashableFinding = (finding: Finding) => ({
  ...JSON.parse(buildComparableFindingKey(finding)),
  risk: finding.risk,
});

export const buildScenarioPromptVersion = (scenario: ReviewScenario) =>
  scenario === "bid_consistency"
    ? reviewPromptVersions.bidConsistency
    : `${reviewPromptVersions.tenderChapter}+${reviewPromptVersions.tenderCrossSection}`;

export const buildConsistencyFingerprint = (params: {
  scenario: ReviewScenario;
  consistencyMode: ReviewConsistencyMode;
  documents: Array<Pick<DocumentRecord, "role" | "contentHash" | "parseMethod" | "extractedText">>;
  regulations?: Array<Pick<Regulation, "id" | "name" | "category" | "updated" | "ruleCount" | "chunks">>;
  model: string;
  promptVersion: string;
}) =>
  hashString(
    JSON.stringify({
      scenario: params.scenario,
      consistencyMode: params.consistencyMode,
      model: params.model,
      promptVersion: params.promptVersion,
      documentHashes: stableSort(params.documents, (document) => `${document.role}:${hashDocumentInput(document)}`).map(
        hashDocumentInput,
      ),
      regulationHashes: stableSort(params.regulations ?? [], hashRegulationSnapshot).map(hashRegulationSnapshot),
    }),
  );

export const deriveDeterministicSeed = (fingerprint: string) => toDeterministicSeed(fingerprint);

export const buildConsistencyRunHash = (findings: Finding[]) =>
  hashString(
    JSON.stringify(
      stableSort(findings, (finding) => `${buildComparableFindingKey(finding)}:${finding.risk}`).map(buildHashableFinding),
    ),
  );

export const diffConsistencyHash = (
  previousFindings: Finding[],
  nextFindings: Finding[],
): ReviewConsistencyDiffSummary => {
  const previousMap = new Map(previousFindings.map((finding) => [buildComparableFindingKey(finding), finding.risk]));
  const nextMap = new Map(nextFindings.map((finding) => [buildComparableFindingKey(finding), finding.risk]));

  let added = 0;
  let removed = 0;
  let changedRisk = 0;

  nextMap.forEach((risk, key) => {
    if (!previousMap.has(key)) {
      added += 1;
      return;
    }

    if (previousMap.get(key) !== risk) {
      changedRisk += 1;
    }
  });

  previousMap.forEach((_risk, key) => {
    if (!nextMap.has(key)) {
      removed += 1;
    }
  });

  return {
    added,
    removed,
    changedRisk,
  };
};
