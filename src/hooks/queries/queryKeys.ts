import type { ReviewScenario } from "@/lib/api-types";

export interface FindingsSourceFilters {
  projectId?: string;
  scenario?: ReviewScenario;
}

const normalizeSearch = (search?: string) => search?.trim() ?? "";

const normalizeFindingsSourceFilters = (filters: FindingsSourceFilters = {}) => ({
  projectId: filters.projectId ?? "",
  scenario: filters.scenario ?? "",
});

const dashboardAll = ["dashboard"] as const;
const projectsAll = ["projects"] as const;
const documentsAll = ["documents"] as const;
const reviewTasksAll = ["review-tasks"] as const;
const findingsAll = ["findings"] as const;
const regulationsAll = ["regulations"] as const;

export const queryKeys = {
  dashboard: {
    all: dashboardAll,
  },
  projects: {
    all: projectsAll,
    list: (search = "") => [...projectsAll, "list", { search: normalizeSearch(search) }] as const,
  },
  documents: {
    all: documentsAll,
    list: (projectId?: string | null) => [...documentsAll, "list", { projectId: projectId ?? "" }] as const,
  },
  reviewTasks: {
    all: reviewTasksAll,
    list: (projectId?: string | null) => [...reviewTasksAll, "list", { projectId: projectId ?? "" }] as const,
  },
  findings: {
    all: findingsAll,
    list: (filters: FindingsSourceFilters = {}) => [...findingsAll, "list", normalizeFindingsSourceFilters(filters)] as const,
  },
  regulations: {
    all: regulationsAll,
    list: (search = "") => [...regulationsAll, "list", { search: normalizeSearch(search) }] as const,
  },
} as const;
