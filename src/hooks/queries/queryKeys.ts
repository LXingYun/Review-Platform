import type { FindingStatus, ReviewScenario } from "@/lib/api-types";

export interface FindingsQueryFilters {
  search?: string;
  status?: FindingStatus;
  projectId?: string;
  scenario?: ReviewScenario;
  taskId?: string;
}

const normalizeSearch = (search?: string) => search?.trim() ?? "";

const normalizeFindingsFilters = (filters: FindingsQueryFilters = {}) => ({
  search: normalizeSearch(filters.search),
  status: filters.status ?? "",
  projectId: filters.projectId ?? "",
  scenario: filters.scenario ?? "",
  taskId: filters.taskId ?? "",
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
    list: (filters: FindingsQueryFilters = {}) => [...findingsAll, "list", normalizeFindingsFilters(filters)] as const,
  },
  regulations: {
    all: regulationsAll,
    list: (search = "") => [...regulationsAll, "list", { search: normalizeSearch(search) }] as const,
  },
} as const;
