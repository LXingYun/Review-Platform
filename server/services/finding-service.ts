import { store } from "../store";
import { FindingReviewLog, FindingStatus, ReviewScenario } from "../types";
import { createId, nowIso } from "../utils";

interface FindingReadCache {
  version: number;
  data: ReturnType<typeof store.get>;
  documentChunkMap: Map<
    string,
    {
      documentId: string;
      documentName: string;
      chunkId: string;
      order: number;
      text: string;
    }
  >;
  regulationChunkMap: Map<
    string,
    {
      regulationId: string;
      regulationName: string;
      regulationCategory: string;
      chunkId: string;
      order: number;
      text: string;
      sectionTitle?: string;
    }
  >;
}

let findingReadCache: FindingReadCache | null = null;

const mapDocumentChunkById = () => {
  const version = store.getVersion();
  if (findingReadCache && findingReadCache.version === version) {
    return findingReadCache;
  }

  const data = store.get();

  const documentChunkMap = new Map(
    data.documents.flatMap((document) =>
      document.chunks.map((chunk) => [
        chunk.id,
        {
          documentId: document.id,
          documentName: document.originalName,
          chunkId: chunk.id,
          order: chunk.order,
          text: chunk.text,
        },
      ]),
    ),
  );

  const regulationChunkMap = new Map(
    data.regulations.flatMap((regulation) =>
      regulation.chunks.map((chunk) => [
        chunk.id,
        {
          regulationId: regulation.id,
          regulationName: regulation.name,
          regulationCategory: regulation.category,
          chunkId: chunk.id,
          order: chunk.order,
          text: chunk.text,
          sectionTitle: chunk.sectionTitle,
        },
      ]),
    ),
  );

  const nextCache: FindingReadCache = {
    version,
    data,
    documentChunkMap,
    regulationChunkMap,
  };

  findingReadCache = nextCache;
  return nextCache;
};

const enrichFinding = (findingId: string) => {
  const { data, documentChunkMap, regulationChunkMap } = mapDocumentChunkById();
  const finding = data.findings.find((item) => item.id === findingId);

  if (!finding) {
    throw new Error("问题记录不存在");
  }

  return {
    ...finding,
    project: data.projects.find((project) => project.id === finding.projectId)?.name ?? "未知项目",
    sourceChunks: finding.sourceChunkIds
      .map((chunkId) => documentChunkMap.get(chunkId))
      .filter((chunk): chunk is NonNullable<typeof chunk> => Boolean(chunk)),
    candidateChunks: finding.candidateChunkIds
      .map((chunkId) => documentChunkMap.get(chunkId))
      .filter((chunk): chunk is NonNullable<typeof chunk> => Boolean(chunk)),
    regulationChunks: finding.regulationChunkIds
      .map((chunkId) => regulationChunkMap.get(chunkId))
      .filter((chunk): chunk is NonNullable<typeof chunk> => Boolean(chunk)),
  };
};

export const listFindings = (params?: {
  search?: string;
  status?: FindingStatus;
  projectId?: string;
  scenario?: ReviewScenario;
  taskId?: string;
}) => {
  const { data, documentChunkMap, regulationChunkMap } = mapDocumentChunkById();
  const keyword = params?.search?.trim();

  return data.findings
    .filter((finding) => {
      if (params?.status && finding.status !== params.status) return false;
      if (params?.projectId && finding.projectId !== params.projectId) return false;
      if (params?.scenario && finding.scenario !== params.scenario) return false;
      if (params?.taskId && finding.taskId !== params.taskId) return false;
      if (!keyword) return true;

      const projectName = data.projects.find((project) => project.id === finding.projectId)?.name ?? "";
      return (
        finding.title.includes(keyword) ||
        finding.category.includes(keyword) ||
        projectName.includes(keyword)
      );
    })
    .map((finding) => ({
      ...finding,
      project: data.projects.find((project) => project.id === finding.projectId)?.name ?? "未知项目",
      sourceChunks: finding.sourceChunkIds
        .map((chunkId) => documentChunkMap.get(chunkId))
        .filter((chunk): chunk is NonNullable<typeof chunk> => Boolean(chunk)),
      candidateChunks: finding.candidateChunkIds
        .map((chunkId) => documentChunkMap.get(chunkId))
        .filter((chunk): chunk is NonNullable<typeof chunk> => Boolean(chunk)),
      regulationChunks: finding.regulationChunkIds
        .map((chunkId) => regulationChunkMap.get(chunkId))
        .filter((chunk): chunk is NonNullable<typeof chunk> => Boolean(chunk)),
    }));
};

const createReviewLog = (params: {
  action: FindingReviewLog["action"];
  status?: FindingStatus;
  note: string;
  reviewer: string;
}): FindingReviewLog => ({
  id: createId("review-log"),
  action: params.action,
  status: params.status,
  note: params.note,
  reviewer: params.reviewer,
  createdAt: nowIso(),
});

export const updateFindingStatus = (
  findingId: string,
  status: FindingStatus,
  note?: string,
  reviewer?: string,
) => {
  let updated = false;

  store.update((current) => ({
    ...current,
    findings: current.findings.map((finding) => {
      if (finding.id !== findingId) return finding;
      updated = true;

      const reviewLogs =
        note && reviewer
          ? [
              createReviewLog({
                action: status === "已确认" ? "confirm" : "ignore",
                status,
                note,
                reviewer,
              }),
              ...finding.reviewLogs,
            ]
          : finding.reviewLogs;

      return {
        ...finding,
        status,
        reviewLogs,
      };
    }),
  }));

  if (!updated) {
    throw new Error("问题记录不存在");
  }

  return enrichFinding(findingId);
};

export const addFindingReviewLog = (findingId: string, note: string, reviewer: string) => {
  let updated = false;

  store.update((current) => ({
    ...current,
    findings: current.findings.map((finding) => {
      if (finding.id !== findingId) return finding;
      updated = true;
      return {
        ...finding,
        reviewLogs: [
          createReviewLog({
            action: "comment",
            note,
            reviewer,
          }),
          ...finding.reviewLogs,
        ],
      };
    }),
  }));

  if (!updated) {
    throw new Error("问题记录不存在");
  }

  return enrichFinding(findingId);
};
