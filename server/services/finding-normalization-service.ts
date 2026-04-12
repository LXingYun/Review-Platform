import { Finding, RiskLevel } from "../types";

const riskOrder: Record<RiskLevel, number> = {
  高: 0,
  中: 1,
  低: 2,
};

const normalizeText = (value: string) => value.replace(/\s+/g, " ").trim();

const normalizeStringList = (values: string[]) =>
  Array.from(new Set(values.map((value) => normalizeText(value)).filter(Boolean))).sort((left, right) => left.localeCompare(right));

const clampConfidence = (value: number) => {
  if (!Number.isFinite(value)) return 0.5;
  return Math.max(0, Math.min(1, value));
};

const normalizeFinding = (finding: Finding): Finding => ({
  ...finding,
  title: normalizeText(finding.title),
  location: normalizeText(finding.location),
  description: normalizeText(finding.description),
  recommendation: normalizeText(finding.recommendation),
  references: normalizeStringList(finding.references),
  sourceChunkIds: normalizeStringList(finding.sourceChunkIds),
  candidateChunkIds: normalizeStringList(finding.candidateChunkIds),
  regulationChunkIds: normalizeStringList(finding.regulationChunkIds),
  confidence: clampConfidence(finding.confidence),
});

const buildFindingFingerprint = (finding: Finding) =>
  JSON.stringify({
    scenario: finding.scenario,
    reviewStage: finding.reviewStage,
    category: finding.category,
    risk: finding.risk,
    title: finding.title,
    location: finding.location,
    description: finding.description,
    recommendation: finding.recommendation,
  });

const buildSortKey = (finding: Finding) =>
  [
    finding.reviewStage,
    finding.category,
    finding.title,
    finding.location,
    finding.description,
    finding.recommendation,
    finding.references.join("|"),
    finding.sourceChunkIds.join("|"),
    finding.candidateChunkIds.join("|"),
    finding.regulationChunkIds.join("|"),
  ].join("::");

const mergeFindings = (current: Finding, incoming: Finding): Finding => ({
  ...current,
  confidence: Math.max(current.confidence, incoming.confidence),
  needsHumanReview: current.needsHumanReview || incoming.needsHumanReview,
  references: normalizeStringList([...current.references, ...incoming.references]),
  sourceChunkIds: normalizeStringList([...current.sourceChunkIds, ...incoming.sourceChunkIds]),
  candidateChunkIds: normalizeStringList([...current.candidateChunkIds, ...incoming.candidateChunkIds]),
  regulationChunkIds: normalizeStringList([...current.regulationChunkIds, ...incoming.regulationChunkIds]),
});

export const normalizeGeneratedFindings = (findings: Finding[]) => {
  const normalized = findings.map(normalizeFinding);
  const mergedByFingerprint = new Map<string, Finding>();

  normalized.forEach((finding) => {
    const fingerprint = buildFindingFingerprint(finding);
    const current = mergedByFingerprint.get(fingerprint);

    mergedByFingerprint.set(fingerprint, current ? mergeFindings(current, finding) : finding);
  });

  return Array.from(mergedByFingerprint.values()).sort((left, right) => {
    const riskDelta = riskOrder[left.risk] - riskOrder[right.risk];
    if (riskDelta !== 0) return riskDelta;

    const keyDelta = buildSortKey(left).localeCompare(buildSortKey(right));
    if (keyDelta !== 0) return keyDelta;

    return left.id.localeCompare(right.id);
  });
};
