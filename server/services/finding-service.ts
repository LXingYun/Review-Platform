import { store } from "../store";
import { FindingStatus, ReviewScenario } from "../types";

const mapDocumentChunkById = () => {
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

  return { data, documentChunkMap, regulationChunkMap };
};

export const listFindings = (params?: {
  search?: string;
  status?: FindingStatus;
  projectId?: string;
  scenario?: ReviewScenario;
}) => {
  const { data, documentChunkMap, regulationChunkMap } = mapDocumentChunkById();
  const keyword = params?.search?.trim();

  return data.findings
    .filter((finding) => {
      if (params?.status && finding.status !== params.status) return false;
      if (params?.projectId && finding.projectId !== params.projectId) return false;
      if (params?.scenario && finding.scenario !== params.scenario) return false;
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

export const updateFindingStatus = (findingId: string, status: FindingStatus) => {
  let updated = false;

  const next = store.update((current) => ({
    ...current,
    findings: current.findings.map((finding) => {
      if (finding.id !== findingId) return finding;
      updated = true;
      return { ...finding, status };
    }),
  }));

  if (!updated) {
    throw new Error("问题记录不存在");
  }

  const { data, documentChunkMap, regulationChunkMap } = mapDocumentChunkById();
  const finding = next.findings.find((item) => item.id === findingId)!;

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
