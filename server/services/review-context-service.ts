import { Regulation, ReviewScenario, ReviewTask } from "../types";

const cloneRegulation = (regulation: Regulation): Regulation => ({
  ...regulation,
  chunks: regulation.chunks.map((chunk) => ({ ...chunk })),
  sections: regulation.sections.map((section) => ({ ...section })),
});

const sortRegulations = (regulations: Regulation[]) => regulations.slice().sort((left, right) => left.id.localeCompare(right.id));

const resolveRequestedRegulations = (params: {
  availableRegulations: Regulation[];
  requestedRegulationIds: string[];
}) => {
  if (params.requestedRegulationIds.length === 0) {
    return sortRegulations(params.availableRegulations);
  }

  const regulationMap = new Map(params.availableRegulations.map((regulation) => [regulation.id, regulation]));
  const missingRegulationIds = params.requestedRegulationIds.filter((id) => !regulationMap.has(id));
  if (missingRegulationIds.length > 0) {
    throw new Error(`法规不存在: ${missingRegulationIds.join(", ")}`);
  }

  return sortRegulations(params.requestedRegulationIds.map((id) => regulationMap.get(id)!));
};

export const resolveTaskRegulationContext = (params: {
  scenario: ReviewScenario;
  availableRegulations: Regulation[];
  requestedRegulationIds?: string[];
}): Pick<ReviewTask, "regulationIds" | "regulationSnapshot"> => {
  if (params.scenario !== "tender_compliance") {
    return {};
  }

  const requestedRegulationIds = (params.requestedRegulationIds ?? []).filter(Boolean);
  const selectedRegulations = resolveRequestedRegulations({
    availableRegulations: params.availableRegulations,
    requestedRegulationIds,
  });

  return {
    regulationIds: selectedRegulations.map((regulation) => regulation.id),
    regulationSnapshot: selectedRegulations.map(cloneRegulation),
  };
};

export const getTaskRegulationsForExecution = (params: {
  task: Pick<ReviewTask, "scenario" | "regulationIds" | "regulationSnapshot">;
  availableRegulations: Regulation[];
}) => {
  if (params.task.scenario !== "tender_compliance") {
    return params.availableRegulations;
  }

  if (params.task.regulationSnapshot !== undefined) {
    return params.task.regulationSnapshot.map(cloneRegulation);
  }

  if (params.task.regulationIds !== undefined) {
    const regulationMap = new Map(params.availableRegulations.map((regulation) => [regulation.id, regulation]));
    return params.task.regulationIds
      .map((id) => regulationMap.get(id))
      .filter((regulation): regulation is Regulation => Boolean(regulation))
      .map(cloneRegulation);
  }

  return params.availableRegulations;
};
